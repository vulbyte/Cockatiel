import protobuf from 'protobufjs';
import WebSocket from 'ws';

export class CockatielClient {
    constructor(wsAddress, protoFilePath, moduleName) {
        this.wsAddress = wsAddress;
        this.protoFilePath = protoFilePath;
        this.moduleName = moduleName;
        this.ws = null;
        this.Container = null;
        this.callbacks = {};
    }

    async init() {
        const root = await protobuf.load(this.protoFilePath);
        this.Container = root.lookupType("cockatiel_protobuf.Container");
    }

    connect(pin, processPosition) {
        return new Promise((resolve, reject) => {
            this.ws = new WebSocket(this.wsAddress);
            
            this.ws.on('open', () => {
                this.send('connectionRequest', {
                    pin: pin,
                    processPosition: processPosition
                });
            });

            this.ws.on('message', (data) => {
                const decoded = this.Container.decode(new Uint8Array(data));
                const payloadType = decoded.type;

                // Handle initial auth return
                if (decoded.connectionRequestReturn) {
                    resolve(true);
                }

                // Fire registered callbacks
                if (this.callbacks[payloadType]) {
                    this.callbacks[payloadType](decoded);
                }
            });

            this.ws.on('error', (err) => reject(err));
        });
    }

    send(payloadKey, payloadData) {
        const message = this.Container.create({
            version: 1,
            type: payloadKey,
            moduleName: this.moduleName,
            [payloadKey]: payloadData // e.g., messageRaw: { jsonData: "..." }
        });
        
        const buffer = this.Container.encode(message).finish();
        this.ws.send(buffer);
    }

    receive(payloadKey, callback) {
        this.callbacks[payloadKey] = callback;
    }
}
