import { Dict, remove } from 'cosmokit'
import { Context, Schema } from '@satorijs/core'
import { Computed } from './filter'

declare global {
  namespace Schemastery {
    interface Static {
      path(options?: Path.Options): Schema<string>
      filter(): Schema<Computed<boolean>>
      computed<X>(inner: X, options?: Computed.Options): Schema<Computed<TypeS<X>>, Computed<TypeT<X>>>
      dynamic(name: string): Schema
    }

    namespace Path {
      interface Options {
        filters?: Filter[]
        allowCreate?: boolean
      }

      type Filter = FileFilter | 'file' | 'directory'

      interface FileFilter {
        name: string
        extensions: string[]
      }
    }
  }
}

Schema.dynamic = function dynamic(name) {
  return Schema.any().role('dynamic', { name }) as never
}

Schema.filter = function filter() {
  return Schema.any().role('filter')
}

Schema.computed = function computed(inner, options = {}) {
  return Schema.union([Schema.from(inner), Schema.any().hidden()]).role('computed', options)
}

Schema.path = function path(options = {}) {
  return Schema.string().role('path', options)
}

const kSchemaOrder = Symbol('schema-order')

declare module '@satorijs/core' {
  interface Context {
    schema: SchemaService
  }

  interface Events {
    'internal/schema'(name: string): void
  }
}

export class SchemaService {
  _data: Dict<Schema> = Object.create(null)

  constructor(public ctx: Context) {}

  extend(name: string, schema: Schema, order = 0) {
    const target = this.get(name)
    const index = target.list.findIndex(a => a[kSchemaOrder] < order)
    schema[kSchemaOrder] = order
    if (index >= 0) {
      target.list.splice(index, 0, schema)
    } else {
      target.list.push(schema)
    }
    this.ctx.emit('internal/schema', name)
    this[Context.current]?.on('dispose', () => {
      remove(target.list, schema)
      this.ctx.emit('internal/schema', name)
    })
  }

  get(name: string) {
    return this._data[name] ||= Schema.intersect([])
  }

  set(name: string, schema: Schema) {
    this._data[name] = schema
    this.ctx.emit('internal/schema', name)
    this[Context.current]?.on('dispose', () => {
      delete this._data[name]
      this.ctx.emit('internal/schema', name)
    })
  }
}

Context.service('schema', SchemaService)
