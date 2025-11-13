/**
 * Example gRPC Server using Effect gRPC transport
 *
 * This example demonstrates how to create a gRPC service with our Effect-based transport
 */

import { Effect, Schema, Stream } from "effect"
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
  Stream.make(
    { message: `Hello stream, ${request.name}! 1` },
    { message: `Hello stream, ${request.name}! 2` },
    { message: `Hello stream, ${request.name}! 3` }
  )

// Create and start the gRPC server
const runServer = Effect.gen(function*() {
  // Create the service layer
  const serviceLayer = GrpcService.make("./src/example/greeter.proto")

  // Register the service methods with specific context
  yield* (Effect.gen(function*() {
    const service = yield* GrpcService.GrpcService
    // const router = yield* GrpcRouter.GrpcRouter

    // Register the service with the gRPC server
    yield* service.register(
      GrpcService.makeService("example", "Greeter", {
        SayHello: GrpcService.makeMethod(HelloRequestSchema, HelloReplySchema, sayHelloHandler),
        SayHelloStream: GrpcService.makeStreamMethod(HelloRequestSchema, HelloReplySchema, sayHelloStreamHandler)
      })
    )

    // Start the server
    yield* service.start(50051)
    console.log("gRPC server running on port 50051")
  })).pipe(
    // Effect.provide(serverLayer)
    Effect.provide(serviceLayer)
  )
})

// Run the server
Effect.runPromise(runServer).catch(console.error)
