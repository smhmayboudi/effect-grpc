/**
 * Example gRPC Client using Effect gRPC transport
 *
 * This example demonstrates how to create a gRPC client with our Effect-based transport
 */

import { Effect, Layer, Schema, Stream } from "effect"
import * as GrpcClient from "../Client.js"
import * as GrpcTransport from "../Transport.js"

// Define schemas for request and response (same as server)
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

// Define the client methods
const sayHelloMethod = GrpcClient.makeMethod(
  "/example.Greeter/SayHello",
  HelloRequestSchema,
  HelloReplySchema
)

const sayHelloStreamMethod = GrpcClient.makeMethod(
  "/example.Greeter/SayHelloStream",
  HelloRequestSchema,
  HelloReplySchema
)

// Create and run the gRPC client
const runClient = Effect.gen(function*() {
  // Transport configuration
  const transportConfig: GrpcTransport.GrpcTransportConfig = {
    protoPath: "./src/example/greeter.proto",
    serviceName: "Greeter",
    url: "localhost:50051"
  }

  // Create the transport layer
  const transportLayer = GrpcTransport.makeLive(transportConfig)

  // Create the client layer
  const clientLayer = GrpcClient.makeLive

  // Combine the layers
  const clientAppLayer = Layer.provide(clientLayer, transportLayer)

  // Make gRPC calls with the combined layer
  yield* (Effect.gen(function*() {
    const client = yield* GrpcClient.GrpcClient

    // Make unary call
    const unaryResponse = yield* client.call(
      sayHelloMethod,
      { name: "World" }
    )
    console.log("Unary response:", unaryResponse)

    // Make streaming call
    const streamResponse = yield* Stream.runCollect(
      client.callStream(
        sayHelloStreamMethod,
        { name: "World" }
      )
    )
    console.log("Stream response:", Array.from(streamResponse))
  }) as Effect.Effect<void, never, never>).pipe(Effect.provide(clientAppLayer))
})

// Run the client
Effect.runPromise(runClient).catch(console.error)
