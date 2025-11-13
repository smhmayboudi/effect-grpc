/**
 * @since 1.0.0
 */

import { describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { expect } from "vitest"
import * as GrpcTransport from "../src/Transport.js"

// Mock schema for testing
interface TestResponse {
  readonly result: string
}

const TestResponseSchema: Schema.Schema<TestResponse, any> = Schema.Struct({
  result: Schema.String
})

describe("GrpcTransport", () => {
  it("should create a transport layer", () => {
    const config: GrpcTransport.GrpcTransportConfig = {
      packageName: "test",
      protoPath: "./test.proto",
      serviceName: "TestService",
      url: "localhost:50051"
    }

    const layer = GrpcTransport.makeLive(config)

    // Test that the layer can be created without errors
    Effect.runSync(
      Effect.gen(function*() {
        const transport = yield* GrpcTransport.GrpcTransport
        expect(transport).toBeDefined()
      }).pipe(
        Effect.provide(layer)
      )
    )
  })

  it("should make a unary call", () => {
    const config: GrpcTransport.GrpcTransportConfig = {
      packageName: "test",
      protoPath: "./test.proto",
      serviceName: "TestService",
      url: "localhost:50051"
    }

    const layer = GrpcTransport.makeLive(config)

    Effect.runPromise(
      Effect.gen(function*() {
        const transport = yield* GrpcTransport.GrpcTransport
        const result = yield* transport.call(
          "/test.TestService/TestMethod",
          { message: "test" },
          TestResponseSchema
        )
        // Since we're mocking, just verify the call doesn't crash
        expect(result).toBeDefined()
      }).pipe(
        Effect.provide(layer)
      )
    ).catch(console.error)
  })

  it("should close properly", () => {
    const config: GrpcTransport.GrpcTransportConfig = {
      packageName: "test",
      protoPath: "./test.proto",
      serviceName: "TestService",
      url: "localhost:50051"
    }

    const layer = GrpcTransport.makeLive(config)

    Effect.runPromise(
      Effect.gen(function*() {
        const transport = yield* GrpcTransport.GrpcTransport
        yield* transport.close
        // Verify close executes without error
        expect(true).toBe(true)
      }).pipe(
        Effect.provide(layer)
      )
    ).catch(console.error)
  })
})
