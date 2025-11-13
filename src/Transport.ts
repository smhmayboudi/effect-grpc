/**
 * @since 1.0.0
 */

import * as grpc from "@grpc/grpc-js"
import * as protoLoader from "@grpc/proto-loader"
import { Context, Effect, Layer, Schema, Stream } from "effect"

/**
 * @since 1.0.0
 * @category errors
 */
export class GrpcError extends Schema.TaggedError<GrpcError>()("GrpcError", {
  message: Schema.String,
  code: Schema.optional(Schema.Number),
  details: Schema.optional(Schema.String)
}) {}

/**
 * @since 1.0.0
 * @category models
 */
export interface GrpcTransportConfig {
  readonly url: string
  readonly packageName: string
  readonly protoPath: string
  readonly serviceName: string
  readonly headers?: Record<string, string>
}

/**
 * @since 1.0.0
 * @category type ids
 */
export const GrpcTransportTypeId = Symbol.for("@template/basic/GrpcTransport")
export type GrpcTransportTypeId = typeof GrpcTransportTypeId

/**
 * @since 1.0.0
 * @category models
 */
export interface GrpcTransport {
  readonly [GrpcTransportTypeId]: GrpcTransportTypeId
  readonly call: <A, R>(
    method: string,
    request: any,
    schema: Schema.Schema<A, any, R>
  ) => Effect.Effect<A, GrpcError, R>
  readonly callStream: <A, R>(
    method: string,
    request: any,
    schema: Schema.Schema<A, any, R>
  ) => Stream.Stream<A, GrpcError, R>
  readonly close: Effect.Effect<void, never>
}

/**
 * @since 1.0.0
 * @category tags
 */
export const GrpcTransport = Context.GenericTag<GrpcTransport>("@template/basic/GrpcTransport")

export const decodeWithSchema =
  <A, R>(schema: Schema.Schema<A, any, R>) => (input: any): Effect.Effect<A, GrpcError, R> =>
    Schema.decode(schema)(input).pipe(
      Effect.mapError((error) =>
        new GrpcError({
          message: `Schema validation failed: ${error}`,
          details: String(error)
        })
      )
    )

export const encodeWithSchema =
  <A, R>(schema: Schema.Schema<A, any, R>) => (input: A): Effect.Effect<any, GrpcError, R> =>
    Schema.encode(schema)(input).pipe(
      Effect.mapError((error) =>
        new GrpcError({
          message: `Schema encoding failed: ${error}`,
          details: String(error)
        })
      )
    )

/**
 * @since 1.0.0
 * @category layers
 */
export const make = (config: GrpcTransportConfig): Layer.Layer<GrpcTransport> =>
  Layer.effect(
    GrpcTransport,
    Effect.gen(function*() {
      const packageDefinition = protoLoader.loadSync(config.protoPath, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      })

      const grpcPackage = grpc.loadPackageDefinition(packageDefinition)

      // Find the service in the package structure
      const service = (grpcPackage[config.packageName] as grpc.GrpcObject)?.[config.serviceName] as
        | grpc.ServiceClientConstructor
        | undefined

      if (!service) {
        return yield* Effect.die(
          new GrpcError({
            message: `Service ${config.serviceName} not found in package ${config.packageName}`,
            details: `Available packages: ${Object.keys(grpcPackage).join(", ")}`
          })
        )
      }

      const client = new service!(config.url, grpc.credentials.createInsecure())

      return GrpcTransport.of({
        [GrpcTransportTypeId]: GrpcTransportTypeId,
        call: (method, request, schema) =>
          Effect.async<any, GrpcError>((resume) => {
            client[method](
              request,
              (error: grpc.ServiceError | null, response: any) => {
                if (error) {
                  resume(Effect.fail(
                    new GrpcError({
                      message: error.message,
                      code: error.code,
                      details: error.details
                    })
                  ))
                } else {
                  resume(Effect.succeed(response))
                }
              }
            )
          }).pipe(
            Effect.flatMap(decodeWithSchema(schema))
          ),
        callStream: (method, request, schema) =>
          Stream.async<any, GrpcError>((emit) => {
            // const call = client[method](request)
            const call = client["SayHelloStream"](request)

            call.on("data", (data: any) => {
              emit.single(Effect.succeed(data))
            })

            call.on("error", (error: grpc.ServiceError) => {
              emit.fail(
                new GrpcError({
                  message: error.message,
                  code: error.code,
                  details: error.details
                })
              )
            })

            call.on("end", () => {
              emit.end()
            })
          }).pipe(
            Stream.flatMap((data) => Stream.fromEffect(decodeWithSchema(schema)(data)))
          ),
        close: Effect.sync(() => {
          client.close()
        })
      })
    }).pipe(
      Effect.tapErrorCause(Effect.logError)
    )
  )
