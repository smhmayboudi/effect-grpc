/**
 * @since 1.0.0
 */

import * as grpc from "@grpc/grpc-js"
import * as protoLoader from "@grpc/proto-loader"
import * as Context from "effect/Context"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"

/**
 * @since 1.0.0
 * @category models
 */
// export interface GrpcService {
//   readonly _: unique symbol
// }

/**
 * @since 1.0.0
 * @category models
 */
export interface GrpcMethodDef<I, O> {
  readonly input: Schema.Schema<I, any>
  readonly output: Schema.Schema<O, any>
  readonly handler: (input: I) => Effect.Effect<O, unknown, any>
}

/**
 * @since 1.0.0
 * @category models
 */
export interface GrpcServiceDef {
  readonly name: string
  readonly methods: Record<string, GrpcMethodDef<any, any>>
}

/**
 * @since 1.0.0
 * @category tags
 */
export class GrpcService extends Context.Tag("@template/basic/GrpcService")<
  GrpcService,
  {
    readonly register: (service: GrpcServiceDef) => Effect.Effect<void>
    readonly start: (port: number) => Effect.Effect<void>
    readonly stop: Effect.Effect<void>
  }
>() {}

/**
 * @since 1.0.0
 * @category constructors
 */
export const makeMethod = <I, O>(
  input: Schema.Schema<I, any>,
  output: Schema.Schema<O, any>,
  handler: (input: I) => Effect.Effect<O, unknown, any>
): GrpcMethodDef<I, O> => ({
  input,
  output,
  handler
})

/**
 * @since 1.0.0
 * @category constructors
 */
export const makeService = (
  name: string,
  methods: Record<string, GrpcMethodDef<any, any>>
): GrpcServiceDef => ({
  name,
  methods
})

/**
 * @since 1.0.0
 * @category layers
 */
export const make: (
  protoPath: string
) => Layer.Layer<GrpcService> = (protoPath) => {
  return Layer.effect(
    GrpcService,
    Effect.sync(() => {
      const server = new grpc.Server()

      return GrpcService.of({
        register: (service: GrpcServiceDef) => {
          return Effect.catchAll(
            Effect.gen(function*() {
              // Load the proto file when register is called
              const packageDefinition = yield* Effect.try({
                try: () =>
                  protoLoader.loadSync(protoPath, {
                    keepCase: true,
                    longs: String,
                    enums: String,
                    defaults: true,
                    oneofs: true
                  }),
                catch: (error) => new Error(`Failed to load proto file: ${error}`)
              })

              const grpcPackage = grpc.loadPackageDefinition(packageDefinition)

              // Get the service definition from the loaded proto
              // gRPC packages typically have the structure grpcPackage[packageName][serviceName]
              let serviceDefinition: any = null

              // First try the direct access (in case service is at root level)
              serviceDefinition = (grpcPackage as any)[service.name]

              // If not found, look for it in the nested package structure
              if (!serviceDefinition) {
                const packageKeys = Object.keys(grpcPackage as any)
                for (const pkg of packageKeys) {
                  if ((grpcPackage as any)[pkg] && (grpcPackage as any)[pkg][service.name]) {
                    serviceDefinition = (grpcPackage as any)[pkg][service.name]
                    break
                  }
                }
              }

              if (!serviceDefinition) {
                throw new Error(`Service ${service.name} not found in proto file`)
              }

              const serviceImpl: grpc.UntypedServiceImplementation = {}

              for (const [methodName, methodDef] of Object.entries(service.methods)) {
                serviceImpl[methodName] = (
                  call: grpc.ServerUnaryCall<any, any>,
                  callback: grpc.sendUnaryData<any>
                ) => {
                  // Decode the request synchronously to avoid context issues
                  try {
                    const decodedRequest = Schema.decodeSync(methodDef.input)(call.request)
                    // Run the handler effect
                    Effect.runPromise(methodDef.handler(decodedRequest) as any).then(
                      (result) => {
                        // Encode the response
                        const encodedResult = Schema.encode(methodDef.output)(result)
                        callback(null, encodedResult)
                      },
                      (error) => {
                        callback(error, null)
                      }
                    )
                  } catch (error) {
                    callback(
                      new Error(
                        `Request validation failed: ${error instanceof Error ? error.message : String(error)}`
                      ),
                      null
                    )
                  }
                }
              }

              // Register the service with the server
              server.addService((serviceDefinition as any).service, serviceImpl)
            }),
            (error) => Effect.die(error)
          )
        },
        start: (port: number) => {
          return Effect.async<void>((resume) => {
            server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (error, portBound) => {
              if (error) {
                resume(Effect.die(error))
              } else {
                // server.start()
                console.log(`gRPC server started on port ${portBound}`)
                resume(Effect.succeed(undefined))
              }
            })
          })
        },
        stop: Effect.sync(() => {
          server.tryShutdown(() => {})
        })
      })
    })
  )
}

/**
 * @since 1.0.0
 * @category layers
 */
export const makeLive: (
  protoPath: string
) => Layer.Layer<GrpcService> = (protoPath) => {
  return make(protoPath)
}
