const EventPublisher = require('../../src/application/ports/EventPublisher');

/** Publicador falso: acumula los eventos que se le piden publicar. */
class FakeEventPublisher extends EventPublisher {
  constructor() {
    super();
    this.published = [];
    this.failWith = null;
  }

  async publishAll(events) {
    if (this.failWith) throw this.failWith;
    this.published.push(...events);
  }

  get names() {
    return this.published.map((event) => event.name);
  }
}

module.exports = FakeEventPublisher;
