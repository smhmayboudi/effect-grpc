/**
 * @since 1.0.0
 */

import { Context, Effect, Layer, type Schema, type Stream } from "effect"
import * as GrpcTransport from "./Transport.js"

/**
 * @since 1.0.0
 * @category models
 */
// export interface GrpcClient {
//   readonly _: unique symbol
// }

/**
 * @since 1.0.0
 * @category models
 */
export interface GrpcClientMethod<I, O, R = never> {
  readonly path: string
  readonly input: Schema.Schema<I, any, R>
  readonly output: Schema.Schema<O, any, R>
}

/**
 * @since 1.0.0
 * @category tags
 */
export class GrpcClient extends Context.Tag("@template/basic/GrpcClient")<
  GrpcClient,
  {
    readonly call: <I, O, R>(
      method: GrpcClientMethod<I, O>,
      input: I
    ) => Effect.Effect<O, unknown, R | GrpcTransport.GrpcTransport>
    readonly callStream: <I, O, R>(
      method: GrpcClientMethod<I, O>,
      input: I
    ) => Stream.Stream<O, unknown, R | GrpcTransport.GrpcTransport>
  }
>() {}

/**
 * @since 1.0.0
 * @category constructors
 */
export const makeMethod = <I, O>(
  path: string,
  input: Schema.Schema<I, unknown>,
  output: Schema.Schema<O, unknown>
): GrpcClientMethod<I, O> => ({
  path,
  input,
  output
})

/**
 * @since 1.0.0
 * @category layers
 */
export const make: Layer.Layer<GrpcClient, never, GrpcTransport.GrpcTransport> = Layer.effect(
  GrpcClient,
  Effect.gen(function*() {
    const transport = yield* GrpcTransport.GrpcTransport

    return GrpcClient.of({
      call: <I, O>(
        method: GrpcClientMethod<I, O>,
        input: I
      ) => transport.call(method.path, input, method.output),
      callStream: <I, O>(
        method: GrpcClientMethod<I, O>,
        input: I
      ) => transport.callStream(method.path, input, method.output)
    })
  })
)

/**
 * @since 1.0.0
 * @category layers
 */
export const makeLive: Layer.Layer<GrpcClient, never, GrpcTransport.GrpcTransport> = make
