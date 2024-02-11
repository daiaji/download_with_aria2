class Aria2 {
    constructor (scheme, host, secret) {
        this.host = host;
        this.secret = 'token:' + secret;
        this.method = scheme;
        this.connect();
    }
    set method (scheme) {
        const methods = { 'http': this.fetch, 'https': this.fetch, 'ws': this.send, 'wss': this.send };
        this.jsonrpc = scheme + '://' + this.host + '/jsonrpc';
        this.post = methods[scheme];
        if (!this.post) { throw new Error('Invalid method: ' + scheme + ' is not supported!'); }
    }
    connect () {
        this.websocket = new Promise((resolve, reject) => {
            const websocket = new WebSocket(this.jsonrpc.replace('http', 'ws'));
            websocket.onopen = (event) => resolve(websocket);
            websocket.onerror = (error) => reject(error);
        });
    }
    disconnect () {
        this.websocket.then( (websocket) => websocket.close() );
    }
    set onmessage (callback) {
        this.websocket.then( (websocket) => websocket.addEventListener('message', (event) => callback(JSON.parse(event.data))) );
    }
    send (message) {
        return new Promise((resolve, reject) => {
            this.websocket.then((websocket) => {
                websocket.onmessage = (event) => resolve(JSON.parse(event.data));
                websocket.onerror = (error) => reject(error);
                websocket.send(message);
            });
        });
    }
    fetch (body) {
        return fetch(this.jsonrpc, {method: 'POST', body}).then((response) => {
            if (response.ok) { return response.json(); }
            throw new Error(response.statusText);
        });
    }
    call (...messages) {
        const json = messages.map( ({method, params = []}) => ({ id: '', jsonrpc: '2.0', method, params: [this.secret, ...params] }) );
        return this.post(JSON.stringify(json)).then( (response) => response.map(({result, error}) => { if (result) { return result; } throw error; }) );
    }
}
