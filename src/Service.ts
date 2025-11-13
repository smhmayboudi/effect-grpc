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
export class GrpcServiceError extends Schema.TaggedError<GrpcServiceError>()("GrpcServiceError", {
  message: Schema.String,
  method: Schema.optional(Schema.String)
}) {}

/**
 * @since 1.0.0
 * @category models
 */
export interface GrpcMethodDef<I, O, R = never> {
  readonly handler: (input: I) => Effect.Effect<O, any, R>
  readonly input: Schema.Schema<I, any, R>
  readonly isStream?: boolean
  readonly output: Schema.Schema<O, any, R>
}

/**
 * @since 1.0.0
 * @category models
 */
export interface GrpcStreamMethodDef<I, O, R = never> {
  readonly handler: (input: I) => Stream.Stream<O, any, R>
  readonly input: Schema.Schema<I, any, R>
  readonly isStream: true
  readonly output: Schema.Schema<O, any, R>
}

/**
 * @since 1.0.0
 * @category models
 */
export interface GrpcServiceDef {
  readonly name: string
  readonly methods: Record<string, GrpcMethodDef<any, any> | GrpcStreamMethodDef<any, any>>
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
  handler,
  input,
  isStream: false,
  output
})

/**
 * @since 1.0.0
 * @category constructors
 */
export const makeStreamMethod = <I, O, R = never>(
  input: Schema.Schema<I, any, R>,
  output: Schema.Schema<O, any, R>,
  handler: (input: I) => Stream.Stream<O, any, R>
): GrpcStreamMethodDef<I, O, R> => ({
  handler,
  input,
  isStream: true,
  output
})

/**
 * @since 1.0.0
 * @category constructors
 */
export const makeService = (
  packageName: string,
  name: string,
  methods: Record<string, GrpcMethodDef<any, any> | GrpcStreamMethodDef<any, any>>
): GrpcServiceDef => ({
  methods,
  name,
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
            const grpcObject = grpcPackage[serviceDef.packageName]
            if (!grpcObject || typeof grpcObject !== "object") {
              return yield* Effect.fail(
                new GrpcServiceError({ message: `Package ${serviceDef.packageName} not found in proto file` })
              )
            }

            const serviceDefinition = (grpcObject as grpc.GrpcObject)[serviceDef.name]
            if (!serviceDefinition) {
              return yield* Effect.fail(
                new GrpcServiceError({ message: `Service ${serviceDef.name} not found in proto file` })
              )
            }

            // Type guard to ensure serviceDefinition has the expected structure
            if (!("service" in serviceDefinition)) {
              return yield* Effect.fail(
                new GrpcServiceError({ message: `Service ${serviceDef.name} does not have the expected structure` })
              )
            }

            const serviceImpl: grpc.UntypedServiceImplementation = {}

            for (const [methodName, methodDef] of Object.entries(serviceDef.methods)) {
              const method = (serviceDefinition as { service: any }).service[methodName]
              const isStream = method.requestStream || method.responseStream || methodDef.isStream
              if (isStream) {
                // Streaming method implementation
                serviceImpl[methodName] = (call: grpc.ServerWritableStream<any, any>) => {
                  // Handle error types by using try/catch to avoid the exactOptionalPropertyTypes issue
                  const runStream = async () => {
                    try {
                      const decoded = Schema.decodeSync(methodDef.input)(call.request)
                      const resultStream = methodDef.handler(decoded)

                      // Process the stream by collecting and then processing each result
                      const results = Array.from(await Effect.runPromise(Stream.runCollect(resultStream)))
                      // Send each result to the client
                      for (const result of results) {
                        const encoded = Schema.encodeSync(methodDef.output)(result)
                        call.write(encoded)
                      }
                      call.end()
                    } catch (error: unknown) {
                      const grpcError = error instanceof Error ? error : new Error(String(error))
                      call.destroy(grpcError)
                    }
                  }
                  runStream().catch((error: unknown) => {
                    const grpcError = error instanceof Error ? error : new Error(String(error))
                    call.destroy(grpcError)
                  })
                }
              } else {
                // Unary method implementation
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
            }

            server.addService((serviceDefinition as { service: grpc.ServiceDefinition }).service, serviceImpl)
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
