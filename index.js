const { app, BrowserWindow, Menu, session } = require('electron')
const Store = require('electron-store');
const fetch = require('electron-fetch').default;
const path = require('path');

const isMac = process.platform === 'darwin'

const STORE = new Store();

const USER_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_1 like Mac OS X) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/10.0 Mobile/14E304 Safari/602.1";
const AGENT_UA = "Mozilla/5.0 (Linux; Android 8.1.0; motorola one Build/OPKS28.63-18-3; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/70.0.3538.80 Mobile Safari/537.36 Instagram 72.0.0.21.98 Android (27/8.1.0; 320dpi; 720x1362; motorola; motorola one; deen_sprout; qcom; pt_BR; 132081645)";

let WINDOWS = {};

app.commandLine.appendSwitch('enable-touch-events')

function swapAccount (account) {
  createWindow(account.partition);
}

function addNewAccount () {
  createWindow(String(Date.now()));
}

function updatePartitionUser (partition, uid) {

  let myAccounts = STORE.get('accounts') || [{ partition: '0', id: 0, label: 'Default' }];
  
  if (uid === null) {
    let index = myAccounts.findIndex((a) => a.partition == partition);
    if (index > 0) {
      myAccounts.splice(myAccounts, 1);
    }
  } else {
    let index = myAccounts.findIndex((a) => a.partition == partition);
    index = (index == -1) ? myAccounts.length : index;

    myAccounts[index] = { partition: partition, id: uid, label: 'Loading' };
  }

  console.log('update partition', myAccounts);

  STORE.set('accounts', myAccounts);
  updateMenu();
}

async function accounts () {
  let accounts = STORE.get('accounts') || [{ partition: '0', id: 0, label: 'Default' }];
  
  let accountsWithNames = await Promise.all(accounts.map(async (account) => {
    if (account.id != 0 && account.id) {
      try {
        let uri;
        let data = await (fetch(uri  ='https://i.instagram.com/api/v1/users/' + account.id + '/info/', { headers: { 'User-Agent': AGENT_UA } }).then((a) => a.json()));
        account.label = data.user.username;
      } catch (e) {
        console.log('ERROR', e)
      }
    }
    return account;
  }))

  return accountsWithNames;
}


async function updateMenu () {

  let menu = [
  // { role: 'appMenu' }
  ...(isMac ? [{
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { role: 'services' },
      { type: 'separator' },
      { role: 'hide' },
      { role: 'hideothers' },
      { role: 'unhide' },
      { type: 'separator' },
      { role: 'quit' }
    ]
  }] : []),
  // { role: 'fileMenu' }
  {
    label: 'File',
    submenu: [
      isMac ? { role: 'close' } : { role: 'quit' }
    ]
  },
  {
    label: 'Accounts',
    submenu: [
      ...((await accounts()).map((a) => ({ label: a.label, click: swapAccount.bind(null, a) }))),
     { type: 'separator' },
     { label: 'Add New Account', click: addNewAccount.bind(null) }
    ]
  },
  // { role: 'viewMenu' }
  {
    label: 'View',
    submenu: [
      { role: 'reload' },
      { role: 'toggledevtools' },
      { type: 'separator' },
      { role: 'resetzoom' },
      { role: 'zoomin' },
      { role: 'zoomout' }
    ]
  },
  // { role: 'windowMenu' }
  {
    label: 'Window',
    submenu: [
      { role: 'minimize' },
      { role: 'zoom' },
      ...(isMac ? [
        { type: 'separator' },
        { role: 'front' },
        { type: 'separator' },
        { role: 'window' }
      ] : [
        { role: 'close' }
      ])
    ]
  }]

  Menu.setApplicationMenu(Menu.buildFromTemplate(menu))
}

function createWindow (partition) {

  updateMenu();

  if (WINDOWS[partition]) {
    WINDOWS[partition].focus();
    return;
  }

  // Create the browser window.
  let win = new BrowserWindow({
    width: 450,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      session: session.fromPartition('persist:sess' + partition),
      preload: path.join(__dirname, 'touch-emulator.js')
    },
    
  })

  WINDOWS[partition] = win;

  win.webContents.setUserAgent(USER_AGENT);

  // and load the index.html of the app.
  win.loadURL('https://www.instagram.com')
  win.webContents.on('did-finish-load', () => {
    win.webContents.executeJavaScript("TouchEmulator(); window.screen={orientation:{type:'portrait-primary',angle:0,onchange:null}};window.dispatchEvent(new Event('resize'));");

    let cookies = win.webContents.session.cookies;
    win.webContents.session.cookies.get({ url: 'https://www.instagram.com', name: 'ds_user_id' }).then((result) => {
      if (result && result[0]) {
        updatePartitionUser(partition, result[0].value);
      } else if (partition != '0') {
        updatePartitionUser(partition, null);
      } else {
        updatePartitionUser(partition, '0')
      }
    });
  });
  win.on('closed', () => {
    delete WINDOWS[partition];
  });
}

app.on('ready', createWindow.bind(null, '0'))
