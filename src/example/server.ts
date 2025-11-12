/**
 * Example gRPC Server using Effect gRPC transport
 *
 * This example demonstrates how to create a gRPC service with our Effect-based transport
 */

import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as GrpcRouter from "../Router.js"
import * as GrpcService from "../Service.js"

// Define schemas for request and response
interface HelloRequest {
  readonly name: string
}

interface HelloReply {
  readonly message: string
}

const HelloRequestSchema: Schema.Schema<HelloRequest, any> = Schema.Struct({
  name: Schema.String
})

const HelloReplySchema: Schema.Schema<HelloReply, any> = Schema.Struct({
  message: Schema.String
})

// Define the service implementation
const sayHelloHandler = (request: HelloRequest) => Effect.succeed<HelloReply>({ message: `Hello, ${request.name}!` })

const sayHelloStreamHandler = (request: HelloRequest) =>
  Effect.succeed<HelloReply>({ message: `Hello stream, ${request.name}!` })

// Create and start the gRPC server
const runServer = Effect.gen(function*() {
  // Create the router layer
  const routerLayer = GrpcRouter.makeLive

  // Create the service layer
  const serviceLayer = GrpcService.makeLive("./src/example/greeter.proto")

  // Combine the layers
  const serverLayer = Layer.provide(routerLayer, serviceLayer)

  // Register the service methods with specific context
  yield* (Effect.gen(function*() {
    const service = yield* GrpcService.GrpcService
    const router = yield* GrpcRouter.GrpcRouter

    // Add routes to the router
    yield* router.addRoute(
      "/example.Greeter/SayHello",
      HelloRequestSchema,
      HelloReplySchema,
      sayHelloHandler
    )

    yield* router.addRoute(
      "/example.Greeter/SayHelloStream",
      HelloRequestSchema,
      HelloReplySchema,
      sayHelloStreamHandler
    )

    // Register the service with the gRPC server
    yield* service.register(
      GrpcService.makeService("Greeter", {
        SayHello: GrpcService.makeMethod(HelloRequestSchema, HelloReplySchema, sayHelloHandler),
        SayHelloStream: GrpcService.makeMethod(HelloRequestSchema, HelloReplySchema, sayHelloStreamHandler)
      })
    )

    // Start the server
    yield* service.start(50051)
    console.log("gRPC server running on port 50051")

    // Handle the router
    yield* router.handle

    // Keep the server running
    yield* Effect.never
  })).pipe(
    Effect.provide(serverLayer),
    Effect.provide(serviceLayer)
  )
})

// Run the server
Effect.runPromise(runServer).catch(console.error)
