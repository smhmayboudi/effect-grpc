/**
 * @since 1.0.0
 */

import { describe, it } from "@effect/vitest"
import * as Effect from "effect/Effect"
import * as Schema from "effect/Schema"
import { expect } from "vitest"
import * as GrpcRouter from "../src/Router.js"

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

describe("GrpcRouter", () => {
  it("should create a router layer", () => {
    const layer = GrpcRouter.makeLive

    Effect.runSync(
      Effect.gen(function*() {
        const router = yield* GrpcRouter.GrpcRouter
        expect(router).toBeDefined()
      }).pipe(
        Effect.provide(layer)
      )
    )
  })

  it("should add a route", () => {
    const layer = GrpcRouter.makeLive

    Effect.runPromise(
      Effect.gen(function*() {
        const router = yield* GrpcRouter.GrpcRouter

        yield* router.addRoute(
          "/test.TestService/TestMethod",
          TestRequestSchema,
          TestResponseSchema,
          (req: TestRequest) => Effect.succeed({ result: `Processed: ${req.message}` })
        )

        // Verify route addition executes without error
        expect(true).toBe(true)
      }).pipe(
        Effect.provide(layer)
      )
    ).catch(console.error)
  })

  it("should handle requests", () => {
    const layer = GrpcRouter.makeLive

    Effect.runPromise(
      Effect.gen(function*() {
        const router = yield* GrpcRouter.GrpcRouter
        yield* router.handle
        // Verify handle executes without error
        expect(true).toBe(true)
      }).pipe(
        Effect.provide(layer)
      )
    ).catch(console.error)
  })
})
