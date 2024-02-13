importScripts('libs/aria2.js', 'libs/core.js', 'libs/tools.js', 'crossbrowser.js');

chrome.runtime.onStartup.addListener(aria2Activate);

chrome.runtime.onInstalled.addListener(async ({reason}) => {
    await aria2Activate();
    aria2ContextMenus();
});

chrome.downloads.onCreated.addListener(async ({id, finalUrl, referrer}) => {
    var url = finalUrl;
    var referer = referrer === '' ? await getCurrentTabUrl() : referrer;
    var hostname = getHostname(referer);
    var skipped = url.startsWith('blob') || url.startsWith('data');
    aria2Monitor[id] = {url, referer, hostname, skipped};
});

chrome.downloads.onDeterminingFilename.addListener(async ({id, filename, fileSize}) => {
    await aria2MV3Migration();
    var {url, referer, hostname, skipped} = aria2Monitor[id];
    if (skipped || !aria2Storage['capture_enabled']) {
        return;
    }
    var captured = getCaptureGeneral(hostname, getFileExtension(filename), fileSize);
    if (captured) {
        chrome.downloads.erase({id});
        aria2Download(url, {out: filename}, referer, hostname);
    }
    aria2Monitor[id].captured = captured;
});

async function aria2Activate() {
    var json = await chrome.storage.sync.get(null);
    aria2Storage = {...aria2Default, ...json};
    aria2ClientSetUp();
    aria2MatchPattern();
    aria2TaskManager();
}

function aria2ClientSetUp() {
    aria2RPC = new Aria2(aria2Storage['jsonrpc_scheme'], aria2Storage['jsonrpc_host'], aria2Storage['jsonrpc_secret']);
}
