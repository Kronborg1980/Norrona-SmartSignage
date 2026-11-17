/* How-to guides shown on the Help page. Plain text only; rendered with textContent. */
(function(root){'use strict';
var guides=[
 {group:'Getting started',items:[
  {id:'setup-screen',title:'Set up a new screen',go:'plan',goText:'Go to Screen content',steps:[
   'Turn on the TV and open the player: in the TV web browser go to this site’s address followed by /player. A big code and a QR code appear.',
   'Scan the QR code with your phone camera. SmartSignage opens with the code already filled in. Log in if asked.',
   'No phone at hand? In SmartSignage tap + Add a screen and type the 12-character code from the TV. Spaces and small letters are fine.',
   'Give the screen a name. Tap one of the suggestions (Reception, Restaurant …) or type your own.',
   'Choose Landscape (wide) or Portrait (tall), the way the screen hangs on the wall.',
   'Tap Add screen. The TV changes to “Screen connected ✓” within a few seconds, and the new screen opens so you can add content right away.'
  ],tips:['Codes expire after 15 minutes. If it has expired, press Generate new code on the TV.','More options → Zone / group lets you group screens, e.g. “Deck 7”, so you can update them together later.']},
  {id:'show-content',title:'Put something on a screen',go:'plan',goText:'Go to Screen content',steps:[
   'Open Screen content and tap the screen.',
   'Tap Add content.',
   'Choose Upload image or video, Write a message, or Choose saved content.',
   'Tap Show it now, all the time ✓ to show it straight away, every day, all day.',
   'Or tap Next: choose when → to pick days, times and dates, and then Add to screen.'
  ],tips:['The screen picks up changes within about a minute.','If you add several items to the same screen, they take turns. Change the seconds per item under “Seconds before the next item”.']},
  {id:'change-content',title:'Change or remove what a screen shows',go:'plan',goText:'Go to Screen content',steps:[
   'Open Screen content and tap the screen.',
   'Under Content on this screen you see everything planned for it.',
   'Tap Edit to change the content or times, or Remove to take it off the screen.'
  ],tips:['“Also applies here” lists content planned for the screen’s group or for all screens. Change it from that group or from All screens.']},
  {id:'preview',title:'Check what a screen will show',go:'plan',goText:'Go to Screen content',steps:[
   'Open Screen content and tap the screen.',
   'Tap Preview screen. You see what is planned right now, using the real player.'
  ],tips:['The preview shows the plan, not a live photo of the TV. A screen that is offline keeps showing what it had last.']}
 ]},
 {group:'Many screens at once',items:[
  {id:'groups',title:'Show the same thing on a group of screens',go:'plan',goText:'Go to Screen content',steps:[
   'Give the screens the same group: Manage screens → Edit → Zone, e.g. “Deck 7”. Or select several screens and use Update selected → Move to zone / group.',
   'Open Screen content and tap the Groups chip at the top.',
   'Tap the group, then Add content as usual. Every screen in the group shows it.'
  ]},
  {id:'all-screens',title:'Show something on every screen',go:'plan',goText:'Go to Screen content',steps:[
   'Open Screen content and tap the All screens chip.',
   'Tap All screens, then Add content.'
  ],tips:['Good for safety messages or announcements. Use “More options → Priority” with a higher number if it must win over other content.']},
  {id:'playlists',title:'Make a playlist (several items that take turns)',go:'channels',goText:'Go to Playlists',steps:[
   'Open Playlists and tap + New playlist. Give it a name.',
   'Add the items you want, e.g. a menu picture, a video and a welcome message.',
   'Tap Use on a screen and choose the screen, group or all screens.'
  ],tips:['Most people do not need playlists: adding several items directly to a screen also makes them take turns.','Changing a playlist changes every screen that uses it.']}
 ]},
 {group:'Pictures, videos and designs',items:[
  {id:'media',title:'Upload pictures and videos',go:'media',goText:'Go to Images & videos',steps:[
   'Open Images & videos and tap + Upload media.',
   'Choose a file: JPG, PNG, WebP, GIF or MP4, up to 25 MB.',
   'The file is saved in the library. Pick it later with Choose saved content or in Design Studio.'
  ],tips:['Use MP4 (H.264) video for Samsung screens.','You can also upload directly while adding content to a screen.']},
  {id:'design',title:'Make a design with several parts (Design Studio)',go:'layouts',goText:'Go to Design Studio',steps:[
   'Open Design Studio and tap + New. Give the design a name and choose 16:9 Landscape or 9:16 Portrait.',
   'Add parts with the buttons: Text, Clock, Image, Video, HTML code, Web page, Playlist or Ticker.',
   'Drag a part to move it. Drag the blue corners to resize it. Change colour, font and size in the Inspector.',
   'Tap Save layout to keep it, or Save & schedule → to choose a screen and times straight away.'
  ],tips:['Design Studio is easiest on a tablet or computer.','Saving a design updates every screen that already uses it.','Only one video per design is allowed on Samsung screens.']},
  {id:'web',title:'Show a web page or your own HTML',go:'layouts',goText:'Go to Design Studio',steps:[
   'In Design Studio add a Web page part and paste an https:// address, or add HTML code and paste your code.',
   'If your HTML needs data from the internet, turn on Allow external HTTPS resources.',
   'Save the design and put it on a screen.'
  ],tips:['The web page must allow being shown inside another page. Some sites block it.','Web pages need the network; they do not work while the ship is offline.']}
 ]},
 {group:'Managing screens',items:[
  {id:'edit-screen',title:'Rename, regroup or turn a screen',go:'screens',goText:'Go to Manage screens',steps:[
   'Open Manage screens and tap Edit on the screen.',
   'Change the name, zone (group), orientation or default layout and tap Save.'
  ]},
  {id:'bulk',title:'Change many screens at once',go:'screens',goText:'Go to Manage screens',steps:[
   'Open Manage screens. Use search, zone and status to find the screens.',
   'Tick the screens, or Select all.',
   'Tap Update selected and choose: assign default layout, move to zone / group, set orientation, enable or disable.'
  ]},
  {id:'disable',title:'Pause or replace a screen',go:'screens',goText:'Go to Manage screens',steps:[
   'To pause a screen: Edit → untick Enabled. It keeps showing what it had but stops updating.',
   'To disconnect it (e.g. a replaced TV): Edit → Revoke device token / require re-pair.',
   'To connect the TV again, follow “Set up a new screen”.'
  ]}
 ]},
 {group:'Good to know',items:[
  {id:'utc',title:'All times are UTC',steps:[
   'Times you choose for content are in UTC (world time), not local time. The ship sails between time zones, so UTC keeps the plan the same everywhere.',
   'Denmark is UTC+1 in winter and UTC+2 in summer. Faroe Islands and Iceland are UTC+0 in winter.'
  ],tips:['Example: to show breakfast 07:00–10:00 Danish winter time, choose 06:00–09:00 UTC.']},
  {id:'offline',title:'What happens when the ship is offline',steps:[
   'Screens save their content and keep playing it without internet, also after a restart.',
   'New changes reach a screen the next time it is online, usually within a minute.',
   'Online / Offline in the lists shows whether the screen has checked in within the last 3 minutes.'
  ],tips:['Web pages and live data need internet. Pictures, videos, messages and clocks work offline.']},
  {id:'trouble',title:'Something is not working',steps:[
   'The TV shows a code: it is not connected yet (new TV, reset player or cleared browser data). Set it up with the code.',
   'The TV says “Device revoked — re-pair required”: open the player with ?debug=1 at the end of the address, press Unpair and set it up again.',
   'New content does not appear: check that the screen is Online, use Preview screen, and check the times (UTC).',
   'The picture is cut off or has black bars: in Design Studio choose the part and switch Media scaling between contain and cover.'
  ]},
  {id:'samsung',title:'Samsung signage screens',steps:[
   'On Samsung signage screens you can start the player automatically instead of opening a browser. This uses the screen’s “URL Launcher / Custom App” setting.',
   'This needs a signed player app. Ask the person who manages SmartSignage before changing the screen’s settings.',
   'Until then, open this site’s address followed by /player in the screen’s web browser.'
  ]}
 ]}
];
function el(tag,attrs,children){var a=document.createElement(tag);Object.keys(attrs||{}).forEach(function(k){if(k==='class')a.className=attrs[k];else if(k==='text')a.textContent=attrs[k];else if(k==='onclick')a.addEventListener('click',attrs[k]);else a.setAttribute(k,attrs[k]);});(children||[]).forEach(function(c){a.append(typeof c==='string'?document.createTextNode(c):c);});return a;}
function render(container,go){
 container.replaceChildren();
 var search=el('input',{type:'search',placeholder:'Search, e.g. “video” or “group”','aria-label':'Search the guides',class:'help-search'});
 var list=el('div',{class:'help-list'}),none=el('p',{class:'empty hidden',text:'No guide matches. Try another word.'});
 var sections=[];
 guides.forEach(function(g){
  var sec=el('section',{class:'help-group'},[el('h3',{text:g.group})]);
  g.items.forEach(function(item){
   var body=el('div',{class:'help-body'},[el('ol',{class:'help-steps'},item.steps.map(function(s){return el('li',{text:s});}))]);
   if(item.tips)body.append(el('div',{class:'help-tips'},[el('strong',{text:'Tips'})].concat(item.tips.map(function(t){return el('p',{text:t});}))));
   if(item.go)body.append(el('button',{type:'button',class:'primary help-go',text:(item.goText||'Go there')+' →',onclick:function(){go(item.go);}}));
   var d=el('details',{class:'help-item',id:'help-'+item.id},[el('summary',{text:item.title}),body]);
   d.dataset.search=(g.group+' '+item.title+' '+item.steps.join(' ')+' '+(item.tips||[]).join(' ')).toLowerCase();
   sec.append(d);sections.push({sec:sec,d:d});
  });
  list.append(sec);
 });
 search.addEventListener('input',function(){
  var q=search.value.trim().toLowerCase(),shown=0;
  list.querySelectorAll('.help-group').forEach(function(sec){var any=false;sec.querySelectorAll('.help-item').forEach(function(d){var hit=!q||q.split(/\s+/).every(function(w){return d.dataset.search.indexOf(w)!==-1;});d.classList.toggle('hidden',!hit);if(hit){any=true;shown++;}if(q&&hit)d.open=true;});sec.classList.toggle('hidden',!any);});
  none.classList.toggle('hidden',shown>0);
 });
 container.append(search,list,none);
}
function open(id){var d=document.getElementById('help-'+id);if(!d)return;d.open=true;setTimeout(function(){d.scrollIntoView({block:'start',behavior:'smooth'});},30);}
root.SmartSignageHelp={render:render,open:open,guides:guides};
})(window);
