import { Runtime } from 'foldkit'

import {
  Message,
  Model,
  init,
  motionTransition,
  subscriptions,
  update,
  view,
} from './main'

const application = Runtime.makeApplication({
  Model,
  init,
  update,
  view,
  subscriptions,
  viewTransition: ({ previousModel, model }) =>
    motionTransition(previousModel, model),
  container: document.getElementById('root'),
  devTools: {
    Message,
  },
})

Runtime.run(application)

import('./twin-viewer').catch(() => undefined)
