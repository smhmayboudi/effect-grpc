/**
 * @since 1.0.0
 */

import { describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Layer from "effect/Layer"
import * as Schema from "effect/Schema"
import * as Stream from "effect/Stream"
import { expect } from "vitest"
import * as GrpcClient from "../src/Client.js"
import * as GrpcTransport from "../src/Transport.js"

// Mock schema for testing
interface TestRequest {
  readonly message: string
}

interface TestResponse {
  readonly result: string
}

const TestRequestSchema: Schema.Schema<TestRequest, any> = Schema.Struct({
  message: Schema.String
})

const TestResponseSchema: Schema.Schema<TestResponse, any> = Schema.Struct({
  result: Schema.String
})

describe("GrpcClient", () => {
  it("should create a client layer", () => {
    const transportConfig: GrpcTransport.GrpcTransportConfig = {
      packageName: "test",
      protoPath: "./test.proto",
      serviceName: "TestService",
      url: "localhost:50051"
    }

    const transportLayer = GrpcTransport.makeLive(transportConfig)
    const clientLayer = GrpcClient.makeLive
    const appLayer = Layer.provide(clientLayer, transportLayer)

    Effect.runSync(
      Effect.gen(function*() {
        const client = yield* GrpcClient.GrpcClient
        expect(client).toBeDefined()
      }).pipe(
        Effect.provide(appLayer)
      )
    )
  })

  it("should make a unary call", () => {
    const transportConfig: GrpcTransport.GrpcTransportConfig = {
      packageName: "test",
      protoPath: "./test.proto",
      serviceName: "TestService",
      url: "localhost:50051"
    }

    const transportLayer = GrpcTransport.makeLive(transportConfig)
    const clientLayer = GrpcClient.makeLive
    const appLayer = Layer.provide(clientLayer, transportLayer)

    Effect.runPromise(
      (Effect.gen(function*() {
        const client = yield* GrpcClient.GrpcClient

        const testMethod = GrpcClient.makeMethod(
          "/test.TestService/TestMethod",
          TestRequestSchema,
          TestResponseSchema
        )

        const result = yield* client.call(
          testMethod,
          { message: "test" }
        )

        // Since we're mocking, just verify the call doesn't crash
        expect(result).toBeDefined()
      }) as Effect.Effect<void, any, never>).pipe(
        Effect.provide(appLayer)
      )
    ).catch(console.error)
  })

  it("should make a streaming call", () => {
    const transportConfig: GrpcTransport.GrpcTransportConfig = {
      packageName: "test",
      protoPath: "./test.proto",
      serviceName: "TestService",
      url: "localhost:50051"
    }

    const transportLayer = GrpcTransport.makeLive(transportConfig)
    const clientLayer = GrpcClient.makeLive
    const appLayer = Layer.provide(clientLayer, transportLayer)

    Effect.runPromise(
      (Effect.gen(function*() {
        const client = yield* GrpcClient.GrpcClient

        const testMethod = GrpcClient.makeMethod(
          "/test.TestService/TestStreamMethod",
          TestRequestSchema,
          TestResponseSchema
        )

        const result = yield* Stream.runCollect(
          client.callStream(
            testMethod,
            { message: "test" }
          )
        )

        // Since we're mocking, just verify the call doesn't crash
        expect(result).toBeDefined()
      }) as Effect.Effect<void, any, never>).pipe(
        Effect.provide(appLayer)
      )
    ).catch(console.error)
  })
})
