var aria2Retry;
var aria2Active;

chrome.action = chrome.browserAction;

if (typeof browser !== 'undefined') {
    chrome.storage.sync = browser.storage.local;
}

chrome.storage.sync.get(null, (json) => {
    aria2Storage = {...aria2Default, ...json};
    aria2MatchPattern();
    aria2ClientSetUp();
    aria2CaptureSwitch();
    aria2TaskManager();
    aria2ContextMenus();
});

async function aria2ClientSetUp() {
    if (aria2Retry) {
        clearTimeout(aria2Retry);
    }
    if (aria2RPC?.websocket) {
        aria2RPC.disconnect();
    }
    aria2RPC = new Aria2(aria2Storage['jsonrpc_uri'], aria2Storage['jsonrpc_token']);
    aria2RPC.call('aria2.tellActive').then((result) => {
        chrome.browserAction.setBadgeBackgroundColor({color: '#3cc'});
        aria2Retry = null;
        aria2Active = result.map(({gid}) => gid);
        aria2ToolbarBadge(aria2Active.length);
        aria2RPC.onmessage = aria2WebSocket;
    }).catch((error) => {
        chrome.browserAction.setBadgeBackgroundColor({color: '#c33'});
        aria2ToolbarBadge('E');
        aria2Retry = setTimeout(aria2ClientSetUp, aria2Storage['manager_interval'])
    });
}

async function aria2WebSocket({method, params}) {
    var {gid} = params[0];
    var adx = aria2Active.indexOf(gid);
    switch (method) {
        case 'aria2.onDownloadStart':
            if (adx === -1) {
                aria2Active.push(gid);
            }
            break;
        case 'aria2.onBtDownloadComplete':
            break;
        case 'aria2.onDownloadComplete':
            var {bittorrent, files} = await aria2RPC.call('aria2.tellStatus', gid);
            var name = getDownloadName(gid, bittorrent, files);
            aria2WhenComplete(name);
        default:
            aria2Active.splice(adx, 1);
    }
    aria2ToolbarBadge(aria2Active.length);
}

function aria2ToolbarBadge(number) {
    chrome.browserAction.setBadgeText({text: number === 0 ? '' : `${number}`});
}
