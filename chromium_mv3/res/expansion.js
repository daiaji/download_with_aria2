var aria2Popup = 'page/popup.html';

chrome.action.onClicked.addListener(tab => {
    chrome.tabs.query({currentWindow: true}, tabs => {
        try {
            var {id} = tabs.find(tab => tab.url.includes(aria2Popup));
            chrome.tabs.update(id, {active: true});
        }
        catch (error) {
            chrome.tabs.create({active: true, url: aria2Popup + '?open_in_tab'});
        }
    });
});

function aria2Manager() {
    if (aria2Store['manager_newtab']) {
        chrome.action.setPopup({popup: ''});
    }
    else {
        chrome.action.setPopup({popup: aria2Popup});
    }
}

function aria2Initial() {
    aria2RPC = new Aria2(aria2Store['jsonrpc_uri'], aria2Store['jsonrpc_token']);
    aria2RPC.call('aria2.getGlobalOption').then(result => {
        chrome.action.setBadgeText({text: ''});
    }).catch(error => {
        chrome.action.setBadgeText({text: 'E'});
        chrome.action.setBadgeBackgroundColor({color: '#c33'});
    });
}