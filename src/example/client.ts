/**
 * Example gRPC Server using Effect gRPC transport
 *
 * This example demonstrates how to create a gRPC service with our Effect-based transport
 */

import { Effect, Layer, Schema } from "effect"
import * as GrpcClient from "../Client.js"
import * as GrpcTransport from "../Transport.js"

// Define schemas with proper typing
const HelloRequestSchema = Schema.Struct({
  name: Schema.String
})

const HelloReplySchema = Schema.Struct({
  message: Schema.String
})

// Define methods
const sayHelloMethod = GrpcClient.makeMethod(
  "SayHello",
  HelloRequestSchema,
  HelloReplySchema
)

const runClient = Effect.gen(function*() {
  const transportConfig = {
    packageName: "example",
    protoPath: "./src/example/greeter.proto",
    serviceName: "Greeter",
    url: "localhost:50051"
  }

  const appLayer = Layer.provide(
    GrpcClient.make(),
    GrpcTransport.make(transportConfig)
  )

  yield* Effect.gen(function*() {
    const client = yield* GrpcClient.GrpcClient

    const response = yield* client.call(sayHelloMethod, { name: "World" })
    console.log("Response:", response)

    // const stream = yield* Stream.runCollect(
    //   client.callStream(sayHelloMethod, { name: "Stream" })
    // )
    // console.log("Stream responses:", Array.from(stream))
  }).pipe(Effect.provide(appLayer))
})

Effect.runPromise(runClient)
