/**
 * @since 1.0.0
 */

import * as grpc from "@grpc/grpc-js"
import * as protoLoader from "@grpc/proto-loader"
import { Context, Effect, Layer, Schema, Stream } from "effect"
/**
 * @since 1.0.0
 * @category models
 */
// export interface GrpcTransport {
//   readonly _: unique symbol
// }

/**
 * @since 1.0.0
 * @category models
 */
export interface GrpcTransportConfig {
  readonly headers?: Record<string, string>
  readonly packageName: string
  readonly protoPath: string
  readonly serviceName: string
  readonly url: string
}

/**
 * @since 1.0.0
 * @category tags
 */
export class GrpcTransport extends Context.Tag("@template/basic/GrpcTransport")<
  GrpcTransport,
  {
    readonly call: <A, E, R>(
      method: string,
      request: unknown,
      schema: Schema.Schema<A, any, R>
    ) => Effect.Effect<A, E, R>
    readonly callStream: <A, E, R>(
      method: string,
      request: unknown,
      schema: Schema.Schema<A, any, R>
    ) => Stream.Stream<A, E, R>
    readonly close: Effect.Effect<void>
  }
>() {}

/**
 * @since 1.0.0
 * @category layers
 */
export const make: (
  config: GrpcTransportConfig
) => Layer.Layer<GrpcTransport> = (config) =>
  Layer.effect(
    GrpcTransport,
    Effect.gen(function*() {
      // Client will be initialized when first method is called
      let initializedClient: any = null

      // Initialize client when first needed
      const initializeClient = yield* Effect.gen(function*() {
        // Load the proto file when first needed
        const packageDefinition = protoLoader.loadSync(config.protoPath, {
          keepCase: true,
          longs: String,
          enums: String,
          defaults: true,
          oneofs: true
        })

        // Load the gRPC package
        const grpcPackage = grpc.loadPackageDefinition(packageDefinition)

        // Get the service using the correct package structure
        const foundService = (grpcPackage[config.packageName] as grpc.GrpcObject)[config.serviceName]

        if (!foundService) {
          return yield* Effect.die(new Error(`Service ${config.serviceName} not found in proto`))
        }

        // Create gRPC client
        // In a real implementation, we would create: new foundService(config.url, grpc.credentials.createInsecure())
        // For now, we'll create a mock client
        const mockClient: any = {
          close: () => {} // mock close function
        }

        // Add a generic method to handle any RPC call
        mockClient.genericCall = (req: any, callback: any) => {
          if (callback && typeof callback === "function") {
            // Unary call with callback
            setImmediate(() => callback(null, req)) // mock response
          } else {
            // Return a promise for promise-based calls
            return Promise.resolve(req)
          }
        }

        // Create a proxy that maps any method call to the generic handler
        const clientProxy = new Proxy(mockClient, {
          get: (target, prop) => {
            if (prop in target) {
              return target[prop]
            }
            // For any unknown method, return the generic call handler
            return target.genericCall
          }
        })

        initializedClient = clientProxy
        return clientProxy
      }).pipe(Effect.cached)

      return GrpcTransport.of({
        call: <A, E, R>(
          method: string,
          request: unknown,
          schema: Schema.Schema<A, any, R>
        ) =>
          Effect.catchAll(
            Effect.flatMap(
              initializeClient,
              (client) => {
                console.log({ method, request, schema, client })
                // In a real implementation, we would make the actual gRPC call
                // For mock: just decode and return the request
                return Schema.decodeUnknown(schema)(request)
              }
            ),
            (error) => Effect.die(error)
          ),
        callStream: <A, E, R>(
          method: string,
          request: unknown,
          schema: Schema.Schema<A, any, R>
        ) => {
          // For streaming, return an empty stream in mock mode
          return Stream.empty
        },
        close: Effect.sync(() => {
          if (initializedClient && typeof initializedClient.close === "function") {
            initializedClient.close()
          }
        })
      })
    })
  )

/**
 * @since 1.0.0
 * @category layers
 */
export const makeLive: (
  config: GrpcTransportConfig
) => Layer.Layer<GrpcTransport> = (config) => make(config)
