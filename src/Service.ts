/**
 * @since 1.0.0
 */

import * as grpc from "@grpc/grpc-js"
import * as protoLoader from "@grpc/proto-loader"
import { Context, Effect, Layer, Schema } from "effect"

/**
 * @since 1.0.0
 * @category errors
 */
export class GrpcServiceError extends Schema.TaggedError<GrpcServiceError>()("GrpcServiceError", {
  message: Schema.String,
  method: Schema.optional(Schema.String)
}) {}

/**
 * @since 1.0.0
 * @category models
 */
export interface GrpcMethodDef<I, O, R = never> {
  readonly input: Schema.Schema<I, any, R>
  readonly output: Schema.Schema<O, any, R>
  readonly handler: (input: I) => Effect.Effect<O, any, R>
}

/**
 * @since 1.0.0
 * @category models
 */
export interface GrpcServiceDef {
  readonly name: string
  readonly methods: Record<string, GrpcMethodDef<any, any>>
  readonly packageName: string
}

/**
 * @since 1.0.0
 * @category type ids
 */
export const GrpcServiceTypeId = Symbol.for("@template/basic/GrpcService")
export type GrpcServiceTypeId = typeof GrpcServiceTypeId

/**
 * @since 1.0.0
 * @category models
 */
export interface GrpcService {
  readonly [GrpcServiceTypeId]: GrpcServiceTypeId
  readonly register: (service: GrpcServiceDef) => Effect.Effect<void, GrpcServiceError>
  readonly start: (port: number) => Effect.Effect<void, GrpcServiceError>
  readonly stop: Effect.Effect<void, never>
}

/**
 * @since 1.0.0
 * @category tags
 */
export const GrpcService = Context.GenericTag<GrpcService>("@template/basic/GrpcService")

/**
 * @since 1.0.0
 * @category constructors
 */
export const makeMethod = <I, O, R = never>(
  input: Schema.Schema<I, any, R>,
  output: Schema.Schema<O, any, R>,
  handler: (input: I) => Effect.Effect<O, any, R>
): GrpcMethodDef<I, O, R> => ({
  input,
  output,
  handler
})

/**
 * @since 1.0.0
 * @category constructors
 */
export const makeService = (
  packageName: string,
  name: string,
  methods: Record<string, GrpcMethodDef<any, any>>
): GrpcServiceDef => ({
  name,
  methods,
  packageName
})

/**
 * @since 1.0.0
 * @category layers
 */
export const make = (protoPath: string): Layer.Layer<GrpcService> =>
  Layer.effect(
    GrpcService,
    Effect.sync(() => {
      const packageDefinition = protoLoader.loadSync(protoPath, {
        defaults: true,
        enums: String,
        keepCase: true,
        longs: String,
        oneofs: true
      })
      const grpcPackage = grpc.loadPackageDefinition(packageDefinition)
      const server = new grpc.Server()

      return GrpcService.of({
        [GrpcServiceTypeId]: GrpcServiceTypeId,
        register: (serviceDef: GrpcServiceDef) =>
          Effect.gen(function*() {
            const serviceDefinition = (grpcPackage[serviceDef.packageName] as grpc.GrpcObject)?.[serviceDef.name]

            if (!serviceDefinition) {
              return yield* Effect.fail(
                new GrpcServiceError({ message: `Service ${serviceDef.name} not found in proto file`})
              )
            }

            const serviceImpl: grpc.UntypedServiceImplementation = {}

            for (const [methodName, methodDef] of Object.entries(serviceDef.methods)) {
              serviceImpl[methodName] = (
                call: grpc.ServerUnaryCall<any, any>,
                callback: grpc.sendUnaryData<any>
              ) => {
                const runHandler = Effect.gen(function*() {
                  const decoded = yield* Schema.decode(methodDef.input)(call.request)
                  const result = yield* methodDef.handler(decoded)
                  return yield* Schema.encode(methodDef.output)(result)
                }).pipe(
                  Effect.tapErrorCause(Effect.logError),
                  Effect.runPromise
                )

                runHandler
                  .then((encoded) => callback(null, encoded))
                  .catch((error) => {
                    const grpcError = error instanceof Error ? error : new Error(String(error))
                    callback(grpcError)
                  })
              }
            }

            server.addService((serviceDefinition as any).service, serviceImpl)
          }),
        start: (port: number) =>
          Effect.async<void, GrpcServiceError>((resume) => {
            server.bindAsync(
              `0.0.0.0:${port}`,
              grpc.ServerCredentials.createInsecure(),
              (error, portBound) => {
                if (error) {
                  resume(Effect.fail(new GrpcServiceError({ message: `Failed to bind server: ${error.message}` })))
                } else {
                  // server.start()
                  console.log(`gRPC server started on port ${portBound}`)
                  resume(Effect.void)
                }
              }
            )
          }),
        stop: Effect.async<void>((resume) => {
          server.tryShutdown((error) => {
            if (error) {
              console.error(`gRPC server shutdown error: ${error.message}`)
            }
            resume(Effect.void)
          })
        })
      })
    })
  )
