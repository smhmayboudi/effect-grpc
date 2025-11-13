/**
 * @since 1.0.0
 */

import * as grpc from "@grpc/grpc-js"
import * as protoLoader from "@grpc/proto-loader"
import { Context, Effect, Layer, Schema } from "effect"

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
  readonly handler: (input: I) => Effect.Effect<O, any, any>
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
  handler: (input: I) => Effect.Effect<O, any, any>
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
export const make: (
  protoPath: string
) => Layer.Layer<GrpcService> = (protoPath) =>
  Layer.effect(
    GrpcService,
    Effect.sync(() => {
      const server = new grpc.Server()

      return GrpcService.of({
        register: (service: GrpcServiceDef) =>
          Effect.sync(() => {
            // Load the proto file when register is called
            const packageDefinition = protoLoader.loadSync(protoPath, {
              defaults: true,
              enums: String,
              keepCase: true,
              longs: String,
              oneofs: true
            })

            const grpcPackage = grpc.loadPackageDefinition(packageDefinition)

            // Get the service definition from the loaded proto
            // gRPC packages typically have the structure grpcPackage[packageName][serviceName]
            const serviceDefinition = (grpcPackage[service.packageName] as grpc.GrpcObject)[service.name]

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
                      callback(error)
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
        start: (port: number) =>
          Effect.async((resume) => {
            server.bindAsync(`0.0.0.0:${port}`, grpc.ServerCredentials.createInsecure(), (error, portBound) => {
              if (error) {
                resume(Effect.die(error))
              } else {
                // server.start()
                console.log(`gRPC server started on port ${portBound}`)
                resume(Effect.void)
              }
            })
          }),
        stop: Effect.sync(() => {
          server.tryShutdown((error) => {
            console.log(`gRPC server shutdown with error: ${String(error)}`)
          })
        })
      })
    })
  )

/**
 * @since 1.0.0
 * @category layers
 */
export const makeLive: (
  protoPath: string
) => Layer.Layer<GrpcService> = (protoPath) => make(protoPath)
