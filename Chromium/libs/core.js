var aria2RPC;
var aria2Error = 0;
var aria2Live;

chrome.storage.local.get(null, async result => {
    aria2RPC = 'jsonrpc_uri' in result ? result : await fetch('/options.json').then(response => response.json());
    aria2RPCClient();
});

chrome.storage.onChanged.addListener(changes => {
    Object.keys(changes).forEach(key => {
        aria2RPC[key] = changes[key].newValue;
        ['jsonrpc_uri', 'secret_token', 'refresh_interval'].includes(key) && aria2RPCRefresh();
    });
});

function aria2RPCRefresh() {
    aria2Error = clearTimeout(aria2Live) ?? 0;
    aria2RPCClient();
}

function aria2RPCCall(call, resolve, reject, alive) {
    var json = 'method' in call ? {id: '', jsonrpc: 2, method: call.method, params: [aria2RPC['secret_token']].concat(call.params ?? [])}
        : {id: '', jsonrpc: 2, method: 'system.multicall', params: [ call.map(({method, params = []}) => ({methodName: method, params: [aria2RPC['secret_token'], ...params]})) ]};
    aria2RPCRequest(json, resolve, reject, alive);
}

function aria2RPCRequest(json, resolve, reject, alive) {
    fetch(aria2RPC['jsonrpc_uri'], {method: 'POST', body: JSON.stringify(json)}).then(response => {
        if (response.status !== 200) {
            throw new Error(response.statusText);
        }
        return response.json();
    }).then(({result}) => {
        typeof resolve === 'function' && resolve(result);
    }).catch(error => {
        aria2Error === 0 && typeof reject === 'function' && (aria2Error = reject(error) ?? 1);
    });
    alive && (aria2Live = setTimeout(() => aria2RPCRequest(json, resolve, reject, alive), aria2RPC['refresh_interval']));
}

function showNotification(message = '') {
    chrome.notifications.create({
        type: 'basic',
        title: aria2RPC['jsonrpc_uri'],
        iconUrl: '/icons/icon48.png',
        message
    });
}
