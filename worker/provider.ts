import type { Provider } from '@earendil-works/pi-ai/models'

export const boundedProvider = (provider: Provider): Provider => ({
  ...provider,
  stream: (model, context, options) =>
    provider.stream(
      model,
      context,
      Object.assign({}, options, { maxTokens: 2048 }),
    ),
  streamSimple: (model, context, options) => {
    if (
      context.messages.filter(message => message.role === 'assistant').length >=
      8
    ) {
      throw new Error('Agent reached its eight-generation review limit.')
    }
    return provider.streamSimple(model, context, {
      ...options,
      maxTokens: 2048,
    })
  },
})
