importScripts('/libs/aria2.js');

var aria2;
var core;
var popup;
var socket;
var active;
var waiting;
var stopped;
var status;

addEventListener('connect', event => {
    var port = event.ports[0];
    port.onmessage = event => {
        if (event.data.origin === 'background') {
            initCore(port);
        }
        else {
            initPopup(port);
        }
    }
});

function initCore(port) {
    core = port;
    core.onmessage = event => {
        initManager(...event.data.storage);
    };
}

function initPopup(port) {
    popup = port;
    popup.postMessage({status, active, waiting, stopped});
    popup.onmessage = event => {
        var {storage, manager, remove, gid} = event.data;
        if (storage) {
            initManager(...storage);
        }
        if (manager === 'purge') {
            stopped = [];
        }
        if (remove) {
            var ri = self[remove].findIndex(result => result.gid === gid);
            self[remove].splice(ri, 1);
            popup.postMessage({remove});
        }
    };
}

function management(add, result, remove, pos) {
    self[add].push(result);
    if (remove) {
        self[remove].splice(pos, 1);
    }
    if (popup) {
        popup.postMessage({add, result, remove});
    }
}

function initManager(jsonrpc, secret) {
    if (socket && socket.readyState === 1) {
        socket.close();
    }
    aria2 = new Aria2(jsonrpc, secret);
    aria2.message('aria2.getGlobalStat').then(async ({numWaiting, numStopped}) => {
        active = await aria2.message('aria2.tellActive');
        waiting = await aria2.message('aria2.tellWaiting', [0, numWaiting | 0]);
        stopped = await aria2.message('aria2.tellStopped', [0, numStopped | 0]);
        status = 'OK';
        core.postMessage({text: active.length, color: '#3cc'});
        socket = new WebSocket(jsonrpc.replace('http', 'ws'));
        socket.onmessage = async event => {
            var {method, params: [{gid}]} = JSON.parse(event.data);
            if (method !== 'aria2.onBtDownloadComplete') {
                var result = await aria2.message('aria2.tellStatus', [gid]);
                var ai = active.findIndex(result => result.gid === gid);
                if (method === 'aria2.onDownloadStart') {
                    if (ai === -1) {
                        var wi = waiting.findIndex(result => result.gid === gid);
                        if (wi !== -1) {
                            management('active', result, 'waiting', wi);
                        }
                        else {
                            var si = stopped.findIndex(result => result.gid === gid);
                            if (si !== -1) {
                                management('active', result, 'stopped', si);
                            }
                            else {
                                management('active', result);
                            }
                        }
                    }
                }
                else {
                    if (method === 'aria2.onDownloadPause') {
                        management('waiting', result, 'active', ai);
                    }
                    else {
                        management('stopped', result, 'active', ai);
                    }
                }
                core.postMessage({text: active.length, color: '#3cc'});
            }
        };
    }).catch(error => {
        core.postMessage({text: 'E', color: '#c33'});
        status = error;
    });
}