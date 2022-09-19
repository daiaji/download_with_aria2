class Aria2 {
    constructor (jsonrpc, secret) {
        if (jsonrpc.startsWith('http')) {
            var sender = this.fetch;
        }
        else if (jsonrpc.starsWith('ws')) {
            sender = this.websocket;
        }
        else {
            throw new Error('Invalid JSON RPC URI: Protocal not supported!');
        }
        this.message = function (method, options) {
            var params = [];
            if (secret) {
                params.push('token:' + secret);
            }
            if (options) {
                params.push(...options);
            }
            var message = JSON.stringify({id: '', jsonrpc: '2.0', method, params});
            return sender(jsonrpc, message);
        };
    }
    fetch (jsonrpc, body) {
        return fetch(jsonrpc, {method: 'POST', body}).then(function (response) {
            return response.json();
        }).then(function (json) {
            var {result, error} = json;
            if (result) {
                return result;
            }
            else {
                throw error;
            }
        });
    }
    websocket (jsonrpc, message) {
        return new Promise(function (resolve, reject) {
            var socket = new WebSocket(jsonrpc);
            socket.onopen = function (event) {
                socket.send(message);
            };
            socket.onclose = reject;
            socket.onmessage = function (event) {
                socket.close();
                var {result, error} = JSON.parse(event.data);
                if (result) {
                    resolve(result);
                }
                else {
                    reject(error);
                }
            };
        });
    }
    get methods () {
        return ['aria2.addUri', 'aria2.addTorrent', 'aria2.addMetalink', 'aria2.remove', 'aria2.forceRemove', 'aria2.pause', 'aria2.pauseAll', 'aria2.forcePause', 'aria2.forcePauseAll', 'aria2.unpause', 'aria2.unpauseAll', 'aria2.tellStatus', 'aria2.getUris', 'aria2.getFiles', 'aria2.getPeers', 'aria2.getServers', 'aria2.tellActive', 'aria2.tellWaiting', 'aria2.tellStopped', 'aria2.changePosition', 'aria2.changeUri', 'aria2.getOption', 'aria2.changeOption', 'aria2.getGlobalOption', 'aria2.changeGlobalOption', 'aria2.getGlobalStat', 'aria2.purgeDownloadResult', 'aria2.removeDownloadResult', 'aria2.getVersion', 'aria2.getSessionInfo', 'aria2.shutdown', 'aria2.forceShutdown', 'aria2.saveSession', 'system.multicall', 'system.listMethods', 'system.listNotifications'];
    }
    get notifications () {
        return ['aria2.onDownloadStart', 'aria2.onDownloadPause', 'aria2.onDownloadStop', 'aria2.onDownloadComplete', 'aria2.onDownloadError', 'aria2.onBtDownloadComplete'];
    }
}
