/**
 * @since 1.0.0
 */

import { Context, Effect, Layer, type ParseResult, Schema, Stream } from "effect"
import { GrpcError, GrpcTransport } from "./Transport.js"

/**
 * @since 1.0.0
 * @category type ids
 */
export const GrpcClientMethodTypeId = Symbol.for("@template/basic/GrpcClientMethod")
export type GrpcClientMethodTypeId = typeof GrpcClientMethodTypeId

/**
 * @since 1.0.0
 * @category models
 */
export interface GrpcClientMethod<I, O, R = never> {
  readonly [GrpcClientMethodTypeId]: GrpcClientMethodTypeId
  readonly path: string
  readonly input: Schema.Schema<I, any, R>
  readonly output: Schema.Schema<O, any, R>
}

/**
 * @since 1.0.0
 * @category type ids
 */
export const GrpcClientTypeId = Symbol.for("@template/basic/GrpcClient")
export type GrpcClientTypeId = typeof GrpcClientTypeId

/**
 * @since 1.0.0
 * @category models
 */
export interface GrpcClient {
  readonly [GrpcClientTypeId]: GrpcClientTypeId
  readonly call: <I, O>(
    method: GrpcClientMethod<I, O>,
    input: I
  ) => Effect.Effect<O, ParseResult.ParseError | GrpcError>
  readonly callStream: <I, O>(
    method: GrpcClientMethod<I, O>,
    input: I
  ) => Stream.Stream<O, GrpcError>
}

/**
 * @since 1.0.0
 * @category tags
 */
export const GrpcClient = Context.GenericTag<GrpcClient>("@template/basic/GrpcClient")

/**
 * @since 1.0.0
 * @category constructors
 */
export const makeMethod = <I, O, R = never>(
  path: string,
  input: Schema.Schema<I, any, R>,
  output: Schema.Schema<O, any, R>
): GrpcClientMethod<I, O, R> => ({
  [GrpcClientMethodTypeId]: GrpcClientMethodTypeId,
  path,
  input,
  output
})

/**
 * @since 1.0.0
 * @category layers
 */
export const make = (): Layer.Layer<GrpcClient, never, GrpcTransport> =>
  Layer.effect(
    GrpcClient,
    Effect.gen(function*() {
      const transport = yield* GrpcTransport

      return GrpcClient.of({
        [GrpcClientTypeId]: GrpcClientTypeId,
        call: <I, O>(
          method: GrpcClientMethod<I, O>,
          input: I
        ) =>
          Effect.gen(function*() {
            const encoded = yield* Schema.encode(method.input)(input)

            return yield* transport.call(method.path, encoded, method.output)
          }),
        callStream: <I, O>(
          method: GrpcClientMethod<I, O>,
          input: I
        ) =>
          Stream.fromEffect(
            Schema.encode(method.input)(input).pipe(
              Effect.mapError((error) =>
                new GrpcError({
                  message: `Encoding failed: ${error}`,
                  details: String(error)
                })
              )
            )
          ).pipe(
            Stream.flatMap((encoded) => transport.callStream(method.path, encoded, method.output))
          )
      })
    })
  )
