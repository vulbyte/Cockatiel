import protobuf from 'protobufjs';
import WebSocket from 'ws';

export class CockatielClient {
    constructor(wsAddress, protoFilePath, moduleName) {
        this.wsAddress = wsAddress;
        this.protoFilePath = protoFilePath;
        this.moduleName = moduleName;
        this.ws = null;
        this.Container = null;
        this.root = null;
        this.callbacks = {};
    }

    async init() {
        this.root = await protobuf.load(this.protoFilePath);
        this.Container = this.root.lookupType("cockatiel_protobuf.Container");
    }

    connect(pin, processPosition, priority = 0) {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.wsAddress);

            this.ws.on('open', () => {
                this.send('connectionRequest', {
                    pin: pin,
                    processPosition: processPosition,
                    priority: priority
                });
            });

            this.ws.on('message', (data) => {
                try {
                    const decoded = this.Container.decode(new Uint8Array(data));

                    // `payload` is the oneof discriminator. protobufjs exposes it as a
                    // virtual property holding the *name* of whichever sub-message is
                    // actually populated (e.g. "messagePostProcess"). This is far more
                    // reliable than the free-text `type` field on Container: the engine
                    // clones/forwards containers between pipeline stages without always
                    // updating `type` to match the payload they currently carry, so
                    // dispatching on `type` will fire the wrong callback (or none).
                    const payloadKey = decoded.payload;

                    if (payloadKey === 'connectionRequestReturn') {
                        resolve(true);
                    }

                    if (payloadKey && this.callbacks[payloadKey]) {
                        // Hand the callback the unwrapped sub-message (e.g. the
                        // MessagePostProcess itself) plus the full container in case
                        // it needs top-level fields like auth_token or module_name.
                        this.callbacks[payloadKey](decoded[payloadKey], decoded);
                    }
                } catch (err) {
                    console.error('[CockatielClient]: Failed to decode incoming WebSocket frame:', err);
                }
            });

            this.ws.on('error', (err) => reject(err));
            this.ws.on('close', (code, reason) => {
                console.warn(`[CockatielClient]: WebSocket connection closed (Code: ${code}, Reason: ${reason})`);
            });
        });
    }

    send(payloadKey, payloadData) {
        if (!this.root || !this.Container) {
            throw new Error('[CockatielClient]: Client not initialized. Call await init() first.');
        }

        const fieldDef = this.Container.fields[payloadKey];
        if (!fieldDef || !fieldDef.resolvedType) {
            throw new Error(`[CockatielClient]: '${payloadKey}' is not a valid Container payload field. Check the .proto oneof for the correct camelCase name.`);
        }

        // Guard against the exact bug that caused messages to vanish before:
        // passing a property that doesn't exist on the target message used to
        // fail silently (protobufjs just drops it at encode time), shipping an
        // empty/default-valued message with no error anywhere. Warn instead.
        const validFields = new Set(fieldDef.resolvedType.fieldsArray.map(f => f.name));
        for (const key of Object.keys(payloadData || {})) {
            if (!validFields.has(key)) {
                console.warn(
                    `[CockatielClient]: '${key}' is not a field on ${fieldDef.resolvedType.name} and will be silently dropped. ` +
                    `Valid fields: ${[...validFields].join(', ')}`
                );
            }
        }

        const wrappedData = fieldDef.resolvedType.create(payloadData);

        const message = this.Container.create({
            version: 1,
            type: payloadKey,
            moduleName: this.moduleName,
            [payloadKey]: wrappedData
        });

        const buffer = this.Container.encode(message).finish();
        this.ws.send(buffer);
    }

    receive(payloadKey, callback) {
        this.callbacks[payloadKey] = callback;
    }
}

