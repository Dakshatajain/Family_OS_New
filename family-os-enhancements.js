(function () {
  'use strict';

  window.createFamilyOSEnhancements = function (env) {
    const {
      React, html, C, Badge, Btn, Card, Inp, Sel, Txa, Modal,
      auth, fileStorage, today, fmt, daysUntil, uid, recurringDate,
      safeFilename, formatBytes, LegacyBabyCorner
    } = env;

    const { useState, useEffect } = React;

    const allowedFile = file => {
      const t = file.type || '';
      const n = file.name || '';
      return (
        t.startsWith('image/') ||
        [
          'application/pdf',
          'text/csv',
          'text/plain',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        ].includes(t) ||
        /\.(csv|xlsx?|docx?|pptx?|pdf|txt|png|jpe?g|heic|webp)$/i.test(n)
      );
    };

    async function uploadAny(files, area, itemId, setProgress = () => {}) {
      if (!fileStorage || !auth?.currentUser) throw new Error('File storage is not ready.');
      const list = Array.from(files || []);
      const uploaded = [];

      for (let i = 0; i < list.length; i++) {
        const file = list[i];
        if (!allowedFile(file)) throw new Error(`Unsupported file: ${file.name}`);
        if (file.size > 10 * 1024 * 1024) throw new Error('Each file must be smaller than 10 MB.');

        const attachmentId = uid();
        const storagePath =
          `users/${auth.currentUser.uid}/${area}/${itemId}/${attachmentId}-${safeFilename(file.name)}`;
        const ref = fileStorage.ref(storagePath);

        await new Promise((resolve, reject) => {
          const task = ref.put(file, { contentType: file.type || 'application/octet-stream' });
          task.on(
            'state_changed',
            snap => setProgress(
              Math.round(((i + snap.bytesTransferred / snap.totalBytes) / list.length) * 100)
            ),
            reject,
            resolve
          );
        });

        uploaded.push({
          id: attachmentId,
          storagePath,
          originalName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          createdAt: new Date().toISOString()
        });
      }

      setProgress(100);
      return uploaded;
    }

    async function openAttachment(att) {
      try {
        const url = await fileStorage.ref(att.storagePath).getDownloadURL();
        window.open(url, '_blank', 'noopener,noreferrer');
      } catch (e) {
        alert(`Could not open file: ${e.message}`);
      }
    }

    async function removeStored(att) {
      if (!att?.storagePath) return;
      try {
        await fileStorage.ref(att.storagePath).delete();
      } catch (e) {
        if (e.code !== 'storage/object-not-found') throw e;
      }
    }

    const fileIcon = att => {
      const t = att?.mimeType || '';
      const n = att?.originalName || '';
      if (t.startsWith('image/')) return '🖼️';
      if (t === 'application/pdf' || /\.pdf$/i.test(n)) return '📄';
      if (/sheet|excel|csv/i.test(t) || /\.(xlsx?|csv)$/i.test(n)) return '📊';
      if (/word/i.test(t) || /\.docx?$/i.test(n)) return '📝';
      return '📎';
    };

    function UniversalAttachments({ value = [], onChange, area, itemId, label = 'Files & photos' }) {
      const [busy, setBusy] = useState(false);
      const [progress, setProgress] = useState(0);

      const add = async files => {
        if (!files?.length) return;
        setBusy(true);
        setProgress(0);
        try {
          const added = await uploadAny(files, area, itemId, setProgress);
          onChange([...(value || []), ...added]);
        } catch (e) {
          alert(e.message || 'Upload failed.');
        } finally {
          setBusy(false);
          setProgress(0);
        }
      };

      const del = async att => {
        if (!confirm(`Delete ${att.originalName}?`)) return;
        try {
          await removeStored(att);
          onChange((value || []).filter(x => x.id !== att.id));
        } catch (e) {
          alert(e.message || 'Delete failed.');
        }
      };

      return html`
        <div style=${{ display:'flex', flexDirection:'column', gap:8 }}>
          <label style=${{fontSize:13,fontWeight:600,color:C.textMuted}}>${label}</label>
          <div style=${{display:'flex',gap:8,flexWrap:'wrap'}}>
            <label style=${{
              border:`1.5px dashed ${C.sageMd}`, background:C.sageLt, color:C.sage,
              borderRadius:8, padding:'9px 12px', fontSize:13, fontWeight:600, cursor:'pointer'
            }}>
              📎 Upload file
              <input
                type="file"
                multiple
                accept=".pdf,.csv,.xls,.xlsx,.doc,.docx,.ppt,.pptx,.txt,image/*"
                onChange=${e => add(e.target.files)}
                style=${{display:'none'}}
              />
            </label>
            <label style=${{
              border:`1.5px dashed ${C.blue}`, background:C.blueLt, color:C.blue,
              borderRadius:8, padding:'9px 12px', fontSize:13, fontWeight:600, cursor:'pointer'
            }}>
              📷 Photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange=${e => add(e.target.files)}
                style=${{display:'none'}}
              />
            </label>
          </div>
          ${busy && html`<div style=${{fontSize:12,color:C.sage}}>Uploading… ${progress}%</div>`}
          ${(value || []).map(att => html`
            <div key=${att.id} style=${{
              display:'flex',alignItems:'center',gap:8,border:`1px solid ${C.border}`,
              borderRadius:8,padding:'8px 10px'
            }}>
              <span>${fileIcon(att)}</span>
              <button
                onClick=${() => openAttachment(att)}
                style=${{
                  flex:1,textAlign:'left',border:'none',background:'none',color:C.blue,cursor:'pointer',
                  fontSize:13,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'
                }}
              >${att.originalName}</button>
              <span style=${{fontSize:11,color:C.textLight}}>${formatBytes(att.sizeBytes || 0)}</span>
              <${Btn} variant="ghost" small onClick=${() => del(att)}>✕<//>
            </div>
          `)}
        </div>
      `;
    }

    const tabStyle = active => ({
      border:`1.5px solid ${active ? C.sage : C.border}`,
      background:active ? C.sage : C.card,
      color:active ? '#fff' : C.textMuted,
      borderRadius:8,padding:'8px 12px',cursor:'pointer',
      fontSize:12,fontWeight:600,fontFamily:'inherit',whiteSpace:'nowrap'
    });

    function Tabs({ tabs, value, onChange }) {
      return html`
        <div style=${{display:'flex',gap:6,overflowX:'auto',paddingBottom:4,marginBottom:15}}>
          ${tabs.map(t => html`
            <button key=${t[0]} onClick=${() => onChange(t[0])} style=${tabStyle(value === t[0])}>
              ${t[1]}
            </button>
          `)}
        </div>
      `;
    }

    function Check({ checked, onChange, label }) {
      return html`
        <label style=${{display:'flex',alignItems:'center',gap:7,fontSize:13,color:C.text,cursor:'pointer'}}>
          <input type="checkbox" checked=${!!checked} onChange=${e => onChange(e.target.checked)}
                 style=${{width:17,height:17}}/>
          ${label}
        </label>
      `;
    }

    function LinkButton({ url, label = 'Open link' }) {
      if (!url) return null;
      return html`
        <a href=${url} target="_blank" rel="noopener noreferrer"
           style=${{display:'inline-block',color:C.blue,fontSize:12,fontWeight:600,textDecoration:'none'}}>
          🔗 ${label}
        </a>
      `;
    }

    function CrudList({ title, items = [], onChange, fields, empty = 'Nothing added yet.',
                        addLabel = '+ Add', area = 'files' }) {
      const [modal, setModal] = useState(false);
      const [edit, setEdit] = useState(null);
      const [f, setF] = useState({});

      const blank = () => Object.fromEntries(
        fields.map(x => [x.key, x.type === 'checkbox' ? false : (x.type === 'attachments' ? [] : '')])
      );

      const open = item => {
        setEdit(item || null);
        setF(item ? {...item, attachments:item.attachments || []} : blank());
        setModal(true);
      };

      const save = () => {
        const first = fields.find(x => x.required) || fields[0];
        if (first && first.type !== 'checkbox' && !String(f[first.key] ?? '').trim()) return;
        const row = {...f, id:edit?.id || uid()};
        onChange(edit ? items.map(x => x.id === edit.id ? row : x) : [...items, row]);
        setModal(false);
      };

      const del = item => {
        if (confirm('Delete this item?')) onChange(items.filter(x => x.id !== item.id));
      };

      const toggle = (item, key) => {
        onChange(items.map(x => x.id === item.id ? {...x,[key]:!x[key]} : x));
      };

      return html`
        <div>
          <div style=${{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
            <div style=${{fontWeight:700,fontSize:14,color:C.text}}>${title}</div>
            <${Btn} small onClick=${() => open(null)}>${addLabel}<//>
          </div>

          <div style=${{display:'flex',flexDirection:'column',gap:8}}>
            ${items.map(item => html`
              <${Card} key=${item.id} style=${{padding:'12px 14px'}}>
                <div style=${{display:'flex',gap:10,alignItems:'flex-start'}}>
                  <div style=${{flex:1,minWidth:0}}>
                    <div style=${{fontWeight:700,fontSize:14,color:C.text,marginBottom:5}}>
                      ${item[fields[0].key] || 'Untitled'}
                    </div>
                    <div style=${{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                      ${fields.slice(1).filter(x => x.show !== false).map(field => {
                        const v = item[field.key];
                        if (field.type === 'checkbox') return html`
                          <span key=${field.key} style=${{fontSize:12,color:C.textMuted}}>
                            <strong>${field.label}:</strong>
                            <button onClick=${() => toggle(item,field.key)}
                              style=${{border:'none',background:'none',cursor:'pointer',fontSize:14}}>
                              ${v ? '✅' : '⬜'}
                            </button>
                          </span>`;
                        if (field.type === 'url') return v ? html`
                          <span key=${field.key}><${LinkButton} url=${v}/></span>` : null;
                        if (field.type === 'attachments') return (item.attachments || []).length ? html`
                          <${Badge} key=${field.key} color="blue" small>
                            📎 ${(item.attachments || []).length}
                          <//>` : null;
                        if (!v) return null;
                        return html`
                          <span key=${field.key} style=${{fontSize:12,color:C.textMuted}}>
                            <strong>${field.label}:</strong> ${field.type === 'date' ? fmt(v) : v}
                          </span>`;
                      })}
                    </div>
                    ${item.notes && html`
                      <div style=${{fontSize:12,color:C.textMuted,marginTop:5,whiteSpace:'pre-wrap'}}>
                        ${item.notes}
                      </div>`}
                  </div>
                  <${Btn} variant="ghost" small onClick=${() => open(item)}>✎<//>
                  <${Btn} variant="ghost" small onClick=${() => del(item)}>✕<//>
                </div>
              <//>
            `)}
            ${items.length === 0 && html`
              <${Card}><p style=${{textAlign:'center',fontSize:13,color:C.textMuted}}>${empty}</p><//>`}
          </div>

          <${Modal} title=${edit ? `Edit ${title}` : `Add ${title}`}
                    open=${modal} onClose=${() => setModal(false)}>
            <div style=${{display:'flex',flexDirection:'column',gap:12}}>
              ${fields.map(field => {
                if (field.type === 'checkbox') return html`
                  <${Check} key=${field.key} checked=${!!f[field.key]}
                    onChange=${v => setF({...f,[field.key]:v})} label=${field.label}/>`;
                if (field.type === 'select') return html`
                  <${Sel} key=${field.key} label=${field.label} value=${f[field.key] || ''}
                    onChange=${v => setF({...f,[field.key]:v})} options=${field.options || []}/>`;
                if (field.type === 'textarea') return html`
                  <${Txa} key=${field.key} label=${field.label} value=${f[field.key] || ''}
                    onChange=${v => setF({...f,[field.key]:v})} rows=${3}/>`;
                if (field.type === 'attachments') return html`
                  <${UniversalAttachments} key=${field.key} value=${f.attachments || []}
                    onChange=${v => setF({...f,attachments:v})}
                    area=${area} itemId=${f.id || edit?.id || 'new'}/>`;
                return html`
                  <${Inp} key=${field.key} label=${field.label} type=${field.type || 'text'}
                    value=${f[field.key] || ''} onChange=${v => setF({...f,[field.key]:v})}
                    required=${!!field.required}/>`;
              })}
              <div style=${{display:'flex',justifyContent:'flex-end',gap:8}}>
                <${Btn} variant="outline" onClick=${() => setModal(false)}>Cancel<//>
                <${Btn} onClick=${save}>Save<//>
              </div>
            </div>
          <//>
        </div>
      `;
    }

    function CalendarSection({ data, updateData }) {
      const [view,setView] = useState({month:new Date().getMonth(),year:new Date().getFullYear()});
      const [modal,setModal] = useState(false);
      const [edit,setEdit] = useState(null);
      const blank = {
        title:'',date:'',startTime:'',endTime:'',type:'event',
        recurring:false,reminderMinutes:'',location:'',notes:''
      };
      const [f,setF] = useState(blank);

      const open = item => {
        setEdit(item || null);
        setF(item ? {...blank,...item,reminderMinutes:item.reminderMinutes ?? ''} : {...blank});
        setModal(true);
      };

      const save = () => {
        if (!f.title || !f.date) return;
        const row = {
          ...f,
          id:edit?.id || uid(),
          recurring:!!f.recurring,
          reminderMinutes:f.reminderMinutes === '' ? '' : Number(f.reminderMinutes)
        };
        updateData({
          events:edit ? data.events.map(e => e.id === edit.id ? row : e) : [...data.events,row]
        });
        setModal(false);
      };

      const del = id => {
        updateData({events:data.events.filter(e => e.id !== id)});
        setModal(false);
      };

      const tc = {birthday:C.coral,anniversary:C.purple,appointment:C.blue,event:C.sage};
      const eventTime = e => e.startTime ? `${e.startTime}${e.endTime ? `–${e.endTime}` : ''}` : 'All day';

      const requestNotif = async () => {
        if (!('Notification' in window)) return alert('Notifications are not supported in this browser.');
        const p = await Notification.requestPermission();
        if (p === 'granted') new Notification('Family OS reminders enabled');
      };

      useEffect(() => {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        const timers = [];
        data.events.forEach(e => {
          if (e.reminderMinutes === '' || e.reminderMinutes == null) return;
          const date = recurringDate(e,new Date().getFullYear());
          const when = new Date(`${date}T${e.startTime || '09:00'}:00`);
          const fire = when.getTime() - Number(e.reminderMinutes || 0) * 60000 - Date.now();
          if (fire > 0 && fire < 2147483647) {
            timers.push(setTimeout(
              () => new Notification(e.title,{body:`${eventTime(e)}${e.location ? ` · ${e.location}` : ''}`}),
              fire
            ));
          }
        });
        return () => timers.forEach(clearTimeout);
      },[data.events]);

      const dim = new Date(view.year,view.month+1,0).getDate();
      const fd = new Date(view.year,view.month,1).getDay();

      const evFor = d => {
        const ds = `${view.year}-${String(view.month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        return data.events.filter(e => recurringDate(e,view.year) === ds);
      };

      const upcoming = [...data.events]
        .map(e => ({...e,rd:recurringDate(e,view.year)}))
        .filter(e => daysUntil(e.rd) >= 0)
        .sort((a,b) => daysUntil(a.rd)-daysUntil(b.rd))
        .slice(0,10);

      return html`
        <div>
          <div style=${{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center',marginBottom:16}}>
            <h2 style=${{margin:0,fontSize:22,fontFamily:"'DM Serif Display',serif",color:C.text}}>Calendar</h2>
            <div style=${{display:'flex',gap:6}}>
              <${Btn} variant="outline" small onClick=${requestNotif}>🔔 Enable reminders<//>
              <${Btn} small onClick=${() => open(null)}>+ Event<//>
            </div>
          </div>

          <${Card} style=${{padding:0,marginBottom:14}}>
            <div style=${{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 14px',borderBottom:`1px solid ${C.border}`}}>
              <${Btn} variant="ghost" small onClick=${() => setView(v => ({
                month:v.month === 0 ? 11 : v.month-1, year:v.month === 0 ? v.year-1 : v.year
              }))}>‹<//>
              <strong>${['January','February','March','April','May','June','July','August','September','October','November','December'][view.month]} ${view.year}</strong>
              <${Btn} variant="ghost" small onClick=${() => setView(v => ({
                month:v.month === 11 ? 0 : v.month+1, year:v.month === 11 ? v.year+1 : v.year
              }))}>›<//>
            </div>

            <div style=${{display:'grid',gridTemplateColumns:'repeat(7,1fr)'}}>
              ${['S','M','T','W','T','F','S'].map((x,i) => html`
                <div key=${i} style=${{textAlign:'center',padding:7,fontSize:11,fontWeight:700,color:C.textMuted}}>${x}</div>`)}
            </div>

            <div style=${{display:'grid',gridTemplateColumns:'repeat(7,1fr)'}}>
              ${Array.from({length:fd},(_,i) => html`<div key=${'x'+i}></div>`)}
              ${Array.from({length:dim},(_,i) => i+1).map(d => {
                const es = evFor(d);
                return html`
                  <div key=${d} style=${{minHeight:62,padding:'5px 3px',borderTop:`1px solid ${C.border}`}}>
                    <div style=${{fontSize:11,textAlign:'center',marginBottom:2}}>${d}</div>
                    ${es.slice(0,2).map(e => html`
                      <button key=${e.id} onClick=${() => open(e)}
                        style=${{
                          display:'block',width:'100%',border:'none',background:tc[e.type] || C.sage,color:'#fff',
                          fontSize:9,borderRadius:4,padding:'2px 3px',marginBottom:2,overflow:'hidden',
                          whiteSpace:'nowrap',textOverflow:'ellipsis',cursor:'pointer'
                        }}>
                        ${e.startTime ? `${e.startTime} ` : ''}${e.title}
                      </button>
                    `)}
                  </div>`;
              })}
            </div>
          <//>

          <div style=${{fontWeight:700,fontSize:12,color:C.textMuted,margin:'12px 0 8px',textTransform:'uppercase'}}>
            Coming up
          </div>

          <div style=${{display:'flex',flexDirection:'column',gap:8}}>
            ${upcoming.map(e => html`
              <${Card} key=${e.id} style=${{padding:'12px 14px'}}>
                <div style=${{display:'flex',gap:10,alignItems:'center'}}>
                  <div style=${{width:7,height:7,borderRadius:'50%',background:tc[e.type] || C.sage}}></div>
                  <div style=${{flex:1}}>
                    <div style=${{fontWeight:700,fontSize:14,color:C.text}}>${e.title}</div>
                    <div style=${{fontSize:12,color:C.textMuted}}>
                      ${fmt(e.rd)} · ${eventTime(e)}
                      ${e.location ? ` · ${e.location}` : ''}
                      ${e.reminderMinutes !== '' && e.reminderMinutes != null ? ` · 🔔 ${e.reminderMinutes}m before` : ''}
                    </div>
                  </div>
                  <${Btn} variant="ghost" small onClick=${() => open(e)}>✎<//>
                  <${Btn} variant="ghost" small onClick=${() => del(e.id)}>✕<//>
                </div>
              <//>
            `)}
          </div>

          <${Modal} title=${edit ? 'Edit Event' : 'New Event'} open=${modal} onClose=${() => setModal(false)}>
            <div style=${{display:'flex',flexDirection:'column',gap:12}}>
              <${Inp} label="Title" value=${f.title} onChange=${v => setF({...f,title:v})} required=${true}/>
              <div style=${{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <${Inp} label="Date" type="date" value=${f.date} onChange=${v => setF({...f,date:v})}/>
                <${Sel} label="Type" value=${f.type} onChange=${v => setF({...f,type:v})}
                  options=${['event','birthday','anniversary','appointment']}/>
              </div>
              <div style=${{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <${Inp} label="Start time" type="time" value=${f.startTime} onChange=${v => setF({...f,startTime:v})}/>
                <${Inp} label="End time" type="time" value=${f.endTime} onChange=${v => setF({...f,endTime:v})}/>
              </div>
              <div style=${{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <${Sel} label="Reminder" value=${String(f.reminderMinutes ?? '')}
                  onChange=${v => setF({...f,reminderMinutes:v})}
                  options=${[
                    {value:'',label:'No reminder'},
                    {value:'10',label:'10 minutes before'},
                    {value:'30',label:'30 minutes before'},
                    {value:'60',label:'1 hour before'},
                    {value:'120',label:'2 hours before'},
                    {value:'1440',label:'1 day before'}
                  ]}/>
                <${Inp} label="Location" value=${f.location} onChange=${v => setF({...f,location:v})}/>
              </div>
              <${Check} checked=${!!f.recurring} onChange=${v => setF({...f,recurring:v})}
                        label="Repeat every year"/>
              <${Txa} label="Notes" value=${f.notes} onChange=${v => setF({...f,notes:v})} rows=${3}/>
              <div style=${{display:'flex',justifyContent:'flex-end',gap:8}}>
                <${Btn} variant="outline" onClick=${() => setModal(false)}>Cancel<//>
                ${edit && html`<${Btn} danger onClick=${() => del(edit.id)}>Delete<//>`}
                <${Btn} onClick=${save}>Save<//>
              </div>
            </div>
          <//>
        </div>
      `;
    }

    const STARTER_PACKING = [
      ['Adrith','Diaper','Diapering'],['Adrith','Wipes','Diapering'],['Adrith','Mat','Diapering'],
      ['Adrith','Shoes','Clothes'],['Adrith','Socks','Clothes'],['Adrith','Onesies','Clothes'],
      ['Adrith','Stroller','Essentials'],['Adrith','Plate and spoons','Food Necessity'],
      ['Adrith','Sipper','Food Necessity'],['Adrith','Bowl','Food Necessity'],
      ['Adrith','High chair alternative','Food Necessity'],['Adrith','Bibs','Food Necessity'],
      ['Adrith','Camera / baby monitor','Sleep Necessity'],['Adrith','Sleep sack','Sleep Necessity'],
      ['Adrith','Sleep suits','Sleep Necessity'],['Adrith','White noise machine','Sleep Necessity'],
      ['Adrith','Book','Sleep Necessity'],['Adrith','Portable crib','Sleep Necessity'],['Adrith','Toys','Essentials'],

      ['Akash','Casual shirts','Clothes'],['Akash','T-shirts','Clothes'],['Akash','Jeans','Clothes'],
      ['Akash','Pyjama','Clothes'],['Akash','Night T-shirt','Clothes'],['Akash','Cap','Accessories'],
      ['Akash','Goggles','Accessories'],['Akash','Specs','Accessories'],['Akash','Socks','Clothes'],
      ['Akash','Shoes','Accessories'],['Akash','Perfume','Accessories'],['Akash','Belt','Accessories'],
      ['Akash','Inner wear','Essentials'],['Akash','Swim suit','Swimwear'],['Akash','Jackets','Outerwear'],
      ['Akash','Gloves','Winter wear'],['Akash','Winter beanie cap','Winter wear'],

      ['Dakshata','Tops / shirts','Clothes'],['Dakshata','Bottoms / jeans','Clothes'],
      ['Dakshata','Nightwear','Clothes'],['Dakshata','Inner wear','Essentials'],
      ['Dakshata','Socks','Clothes'],['Dakshata','Shoes','Accessories'],
      ['Dakshata','Jacket','Outerwear'],['Dakshata','Swimwear','Swimwear'],
      ['Dakshata','Toiletries','Essentials'],

      ['Shared','Phone chargers','Electronics'],['Shared','Power bank','Electronics'],
      ['Shared','Medicines / first aid','Health'],['Shared','Travel adapter','Electronics'],
      ['Shared','Snacks','Food'],['Shared','Laundry bag','Essentials']
    ].map((x,i) => ({
      id:`starter-${i+1}`, person:x[0], item:x[1], category:x[2], defaultNeeded:true
    }));

    function Trips({ data, updateData }) {
      const [active,setActive] = useState(null);
      const [tab,setTab] = useState('overview');
      const [modal,setModal] = useState(false);
      const [edit,setEdit] = useState(null);
      const [f,setF] = useState({});

      const master = Array.isArray(data.masterPackingList) ? data.masterPackingList : [];

      useEffect(() => {
        if (!data.masterPackingInitialized) {
          updateData({masterPackingList:STARTER_PACKING,masterPackingInitialized:true});
        }
      },[]);

      const open = item => {
        setEdit(item || null);
        setF(item ? {...item} : {
          destination:'',startDate:'',endDate:'',status:'planning',notes:'',
          travelers:[],itinerary:[],bookings:[],buyList:[],documents:[],expenses:[],tripTasks:[],
          packingSelections:{}
        });
        setModal(true);
      };

      const save = () => {
        if (!f.destination) return;
        const row = {
          travelers:[],itinerary:[],bookings:[],buyList:[],documents:[],expenses:[],tripTasks:[],
          packingSelections:{},
          ...f,
          id:edit?.id || uid()
        };
        updateData({
          trips:edit ? data.trips.map(t => t.id === edit.id ? row : t) : [...data.trips,row]
        });
        setModal(false);
      };

      const at = active ? data.trips.find(t => t.id === active) : null;
      const setTrip = (key,val) => updateData({
        trips:data.trips.map(t => t.id === at.id ? {...t,[key]:val} : t)
      });

      const delTrip = () => {
        if (confirm('Delete this trip?')) {
          updateData({trips:data.trips.filter(t => t.id !== at.id)});
          setActive(null);
        }
      };

      const packSel = at?.packingSelections || {};
      const packState = m => packSel[m.id] || {
        needed:m.defaultNeeded !== false, packed:false, qty:'', notes:''
      };
      const updatePack = (m,patch) => setTrip('packingSelections',{
        ...packSel,[m.id]:{...packState(m),...patch}
      });

      if (!at) return html`
        <div>
          <div style=${{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <h2 style=${{margin:0,fontSize:22,fontFamily:"'DM Serif Display',serif",color:C.text}}>Trips</h2>
            <${Btn} small onClick=${() => open(null)}>+ New Trip<//>
          </div>

          <div style=${{display:'flex',flexDirection:'column',gap:10}}>
            ${data.trips.map(t => html`
              <${Card} key=${t.id} onClick=${() => {setActive(t.id);setTab('overview');}}
                style=${{cursor:'pointer'}}>
                <div style=${{display:'flex',justifyContent:'space-between',gap:10}}>
                  <div style=${{fontWeight:700,fontSize:17,color:C.text}}>${t.destination}</div>
                  <${Badge} color=${t.status === 'confirmed' ? 'blue' : t.status === 'completed' ? 'sage' : 'amber'}>
                    ${t.status || 'planning'}
                  <//>
                </div>
                <div style=${{fontSize:13,color:C.textMuted,marginTop:5}}>
                  📅 ${fmt(t.startDate)} – ${fmt(t.endDate)}
                  · 👥 ${(t.travelers || []).length} travelers
                  · 🎟 ${(t.bookings || []).filter(x => x.booked || x.status === 'booked').length}/${(t.bookings || []).length} booked
                </div>
              <//>
            `)}
            ${data.trips.length === 0 && html`
              <${Card}><p style=${{textAlign:'center',color:C.textMuted}}>Create your first trip.</p><//>`}
          </div>

          <${Modal} title=${edit ? 'Edit Trip' : 'New Trip'} open=${modal} onClose=${() => setModal(false)}>
            <div style=${{display:'flex',flexDirection:'column',gap:12}}>
              <${Inp} label="Destination" value=${f.destination || ''} onChange=${v => setF({...f,destination:v})}/>
              <div style=${{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <${Inp} label="Start" type="date" value=${f.startDate || ''} onChange=${v => setF({...f,startDate:v})}/>
                <${Inp} label="End" type="date" value=${f.endDate || ''} onChange=${v => setF({...f,endDate:v})}/>
              </div>
              <${Sel} label="Status" value=${f.status || 'planning'} onChange=${v => setF({...f,status:v})}
                options=${['planning','confirmed','completed','cancelled']}/>
              <${Txa} label="Notes" value=${f.notes || ''} onChange=${v => setF({...f,notes:v})}/>
              <div style=${{display:'flex',justifyContent:'flex-end',gap:8}}>
                <${Btn} variant="outline" onClick=${() => setModal(false)}>Cancel<//>
                <${Btn} onClick=${save}>Save<//>
              </div>
            </div>
          <//>
        </div>
      `;

      const tabs = [
        ['overview','🏠 Overview'],['travelers','👥 Guests'],['itinerary','🗓 Itinerary'],
        ['bookings','🎟 Bookings'],['packing','🧳 Packing'],['buy','🛒 To Buy'],
        ['docs','📁 Documents'],['budget','💰 Budget'],['tasks','✅ Tasks']
      ];

      return html`
        <div>
          <${Btn} variant="ghost" onClick=${() => setActive(null)}>← Trips<//>

          <div style=${{display:'flex',justifyContent:'space-between',gap:10,alignItems:'flex-start',margin:'8px 0 12px'}}>
            <div>
              <h2 style=${{margin:0,fontSize:22,color:C.text}}>${at.destination}</h2>
              <div style=${{fontSize:13,color:C.textMuted}}>${fmt(at.startDate)} – ${fmt(at.endDate)}</div>
            </div>
            <div style=${{display:'flex',gap:6}}>
              <${Btn} variant="outline" small onClick=${() => open(at)}>Edit<//>
              <${Btn} danger small onClick=${delTrip}>Delete<//>
            </div>
          </div>

          <${Tabs} tabs=${tabs} value=${tab} onChange=${setTab}/>

          ${tab === 'overview' && html`
            <div style=${{display:'grid',gap:10}}>
              <${Card}>
                <div style=${{fontWeight:700,marginBottom:6}}>Trip notes</div>
                <div style=${{fontSize:13,color:C.textMuted,whiteSpace:'pre-wrap'}}>${at.notes || 'No notes yet.'}</div>
              <//>
              <div style=${{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(150px,1fr))',gap:8}}>
                ${[
                  ['Travelers',(at.travelers || []).length],
                  ['Itinerary',(at.itinerary || []).length],
                  ['Bookings',(at.bookings || []).length],
                  ['To buy',(at.buyList || []).filter(x => !x.bought).length],
                  ['Tasks',(at.tripTasks || []).filter(x => !x.done).length]
                ].map(([l,v]) => html`
                  <${Card} key=${l} style=${{padding:'12px'}}>
                    <div style=${{fontSize:20,fontWeight:700,color:C.sage}}>${v}</div>
                    <div style=${{fontSize:12,color:C.textMuted}}>${l}</div>
                  <//>
                `)}
              </div>
            </div>
          `}

          ${tab === 'travelers' && html`
            <${CrudList} title="Traveler / Guest" items=${at.travelers || []}
              onChange=${v => setTrip('travelers',v)} area=${`trips/${at.id}/travelers`}
              fields=${[
                {key:'name',label:'Name',required:true},
                {key:'role',label:'Role / relation'},
                {key:'notes',label:'Notes',type:'textarea'}
              ]}/>
          `}

          ${tab === 'itinerary' && html`
            <${CrudList} title="Itinerary item" items=${at.itinerary || []}
              onChange=${v => setTrip('itinerary',v)} area=${`trips/${at.id}/itinerary`}
              fields=${[
                {key:'title',label:'Activity',required:true},
                {key:'date',label:'Date',type:'date'},
                {key:'time',label:'Time',type:'time'},
                {key:'location',label:'Location'},
                {key:'url',label:'Link',type:'url'},
                {key:'notes',label:'Notes',type:'textarea'}
              ]}/>
          `}

          ${tab === 'bookings' && html`
            <${CrudList} title="Booking" items=${at.bookings || []}
              onChange=${v => setTrip('bookings',v)} area=${`trips/${at.id}/bookings`}
              fields=${[
                {key:'name',label:'Booking / reservation',required:true},
                {key:'type',label:'Type',type:'select',options:['Flight','Hotel','Car','Activity','Restaurant','Train','Other']},
                {key:'booked',label:'Booked',type:'checkbox'},
                {key:'confirmation',label:'Confirmation #'},
                {key:'date',label:'Date',type:'date'},
                {key:'cost',label:'Cost',type:'number'},
                {key:'url',label:'Link',type:'url'},
                {key:'notes',label:'Notes',type:'textarea'}
              ]}/>
          `}

          ${tab === 'packing' && html`
            <div>
              <div style=${{background:C.blueLt,borderRadius:10,padding:'10px 12px',fontSize:12,color:C.blue,marginBottom:12}}>
                This is your reusable master packing list. <strong>Needed</strong> and <strong>Packed</strong>
                are saved separately for this trip.
              </div>

              ${[...new Set(master.map(x => x.person))].map(person => html`
                <div key=${person} style=${{marginBottom:18}}>
                  <div style=${{fontWeight:700,color:C.text,fontSize:14,marginBottom:7}}>${person}</div>
                  <div style=${{overflowX:'auto'}}>
                    <table style=${{width:'100%',borderCollapse:'collapse',minWidth:560}}>
                      <thead>
                        <tr>
                          ${['Item','Category','Needed','Packed','Qty / notes'].map(h => html`
                            <th key=${h} style=${{
                              textAlign:'left',fontSize:11,color:C.textMuted,padding:'7px 6px',
                              borderBottom:`1px solid ${C.border}`
                            }}>${h}</th>
                          `)}
                        </tr>
                      </thead>
                      <tbody>
                        ${master.filter(x => x.person === person).map(m => {
                          const s = packState(m);
                          return html`
                            <tr key=${m.id} style=${{opacity:s.needed ? 1 : .48}}>
                              <td style=${{padding:'7px 6px',fontSize:13,borderBottom:`1px solid ${C.border}`}}>${m.item}</td>
                              <td style=${{padding:'7px 6px',fontSize:12,color:C.textMuted,borderBottom:`1px solid ${C.border}`}}>${m.category}</td>
                              <td style=${{padding:'7px 6px',borderBottom:`1px solid ${C.border}`}}>
                                <input type="checkbox" checked=${!!s.needed}
                                  onChange=${e => updatePack(m,{needed:e.target.checked,packed:e.target.checked ? s.packed : false})}/>
                              </td>
                              <td style=${{padding:'7px 6px',borderBottom:`1px solid ${C.border}`}}>
                                <input type="checkbox" disabled=${!s.needed} checked=${!!s.packed}
                                  onChange=${e => updatePack(m,{packed:e.target.checked})}/>
                              </td>
                              <td style=${{padding:'7px 6px',borderBottom:`1px solid ${C.border}`}}>
                                <input value=${s.notes || s.qty || ''}
                                  onInput=${e => updatePack(m,{notes:e.target.value})}
                                  placeholder="2 / blue bag…"
                                  style=${{width:'100%',border:`1px solid ${C.border}`,padding:'5px 7px',fontSize:12}}/>
                              </td>
                            </tr>
                          `;
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              `)}

              <${CrudList} title="Master packing item" items=${master}
                onChange=${v => updateData({masterPackingList:v,masterPackingInitialized:true})}
                area="packing-master"
                fields=${[
                  {key:'item',label:'Item',required:true},
                  {key:'person',label:'Person'},
                  {key:'category',label:'Category'},
                  {key:'defaultNeeded',label:'Default needed',type:'checkbox'}
                ]}/>

              ${(at.packingList || []).length > 0 && html`
                <div style=${{marginTop:16}}>
                  <div style=${{fontWeight:700,fontSize:13,color:C.text,marginBottom:6}}>
                    Legacy items from this trip
                  </div>
                  ${(at.packingList || []).map(p => html`
                    <div key=${p.id} style=${{fontSize:13,color:C.textMuted,padding:'5px 0'}}>
                      • ${p.item} ${p.packed ? '✓' : ''}
                    </div>`)}
                </div>
              `}
            </div>
          `}

          ${tab === 'buy' && html`
            <${CrudList} title="Thing to buy" items=${at.buyList || []}
              onChange=${v => setTrip('buyList',v)} area=${`trips/${at.id}/buy`}
              fields=${[
                {key:'item',label:'Item',required:true},
                {key:'category',label:'Category'},
                {key:'bought',label:'Bought',type:'checkbox'},
                {key:'price',label:'Price',type:'number'},
                {key:'url',label:'Link',type:'url'},
                {key:'notes',label:'Notes',type:'textarea'}
              ]}/>
          `}

          ${tab === 'docs' && html`
            <${CrudList} title="Travel document" items=${at.documents || []}
              onChange=${v => setTrip('documents',v)} area=${`trips/${at.id}/documents`}
              fields=${[
                {key:'title',label:'Document',required:true},
                {key:'type',label:'Type',type:'select',options:['Boarding pass','Ticket','Passport / visa','Reservation','Insurance','Other']},
                {key:'reference',label:'Reference / confirmation'},
                {key:'url',label:'Link',type:'url'},
                {key:'notes',label:'Notes',type:'textarea'},
                {key:'attachments',label:'Files',type:'attachments'}
              ]}/>
          `}

          ${tab === 'budget' && html`
            <${CrudList} title="Expense" items=${at.expenses || []}
              onChange=${v => setTrip('expenses',v)} area=${`trips/${at.id}/expenses`}
              fields=${[
                {key:'description',label:'Expense',required:true},
                {key:'category',label:'Category'},
                {key:'amount',label:'Amount',type:'number'},
                {key:'paidBy',label:'Paid by'},
                {key:'paid',label:'Paid',type:'checkbox'},
                {key:'notes',label:'Notes',type:'textarea'}
              ]}/>
          `}

          ${tab === 'tasks' && html`
            <${CrudList} title="Trip task" items=${at.tripTasks || []}
              onChange=${v => setTrip('tripTasks',v)} area=${`trips/${at.id}/tasks`}
              fields=${[
                {key:'item',label:'Task',required:true},
                {key:'dueDate',label:'Due',type:'date'},
                {key:'owner',label:'Owner'},
                {key:'done',label:'Done',type:'checkbox'},
                {key:'notes',label:'Notes',type:'textarea'}
              ]}/>
          `}

          <${Modal} title="Edit Trip" open=${modal} onClose=${() => setModal(false)}>
            <div style=${{display:'flex',flexDirection:'column',gap:12}}>
              <${Inp} label="Destination" value=${f.destination || ''} onChange=${v => setF({...f,destination:v})}/>
              <div style=${{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <${Inp} label="Start" type="date" value=${f.startDate || ''} onChange=${v => setF({...f,startDate:v})}/>
                <${Inp} label="End" type="date" value=${f.endDate || ''} onChange=${v => setF({...f,endDate:v})}/>
              </div>
              <${Sel} label="Status" value=${f.status || 'planning'} onChange=${v => setF({...f,status:v})}
                options=${['planning','confirmed','completed','cancelled']}/>
              <${Txa} label="Notes" value=${f.notes || ''} onChange=${v => setF({...f,notes:v})}/>
              <div style=${{display:'flex',justifyContent:'flex-end',gap:8}}>
                <${Btn} variant="outline" onClick=${() => setModal(false)}>Cancel<//>
                <${Btn} onClick=${save}>Save<//>
              </div>
            </div>
          <//>
        </div>
      `;
    }

    function Parties({ data, updateData }) {
      const [active,setActive] = useState(null);
      const [tab,setTab] = useState('overview');
      const [modal,setModal] = useState(false);
      const [edit,setEdit] = useState(null);
      const [f,setF] = useState({});

      const open = item => {
        setEdit(item || null);
        setF(item ? {...item} : {
          name:'',date:'',venue:'',guestCount:'',theme:'',budget:'',notes:'',
          guests:[],checklist:[],schedule:[],menu:[],vendors:[],decor:[],
          activities:[],shopping:[],expenses:[],favors:[],files:[]
        });
        setModal(true);
      };

      const save = () => {
        if (!f.name) return;
        const row = {
          guests:[],checklist:[],schedule:[],menu:[],vendors:[],decor:[],
          activities:[],shopping:[],expenses:[],favors:[],files:[],
          ...f,
          id:edit?.id || uid()
        };
        updateData({
          parties:edit ? data.parties.map(p => p.id === edit.id ? row : p) : [...data.parties,row]
        });
        setModal(false);
      };

      const at = active ? data.parties.find(p => p.id === active) : null;
      const setP = (key,val) => updateData({
        parties:data.parties.map(p => p.id === at.id ? {...p,[key]:val} : p)
      });

      const delP = () => {
        if (confirm('Delete this party?')) {
          updateData({parties:data.parties.filter(p => p.id !== at.id)});
          setActive(null);
        }
      };

      if (!at) return html`
        <div>
          <div style=${{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <h2 style=${{margin:0,fontSize:22,fontFamily:"'DM Serif Display',serif",color:C.text}}>Parties</h2>
            <${Btn} small onClick=${() => open(null)}>+ New Party<//>
          </div>

          <div style=${{display:'flex',flexDirection:'column',gap:10}}>
            ${data.parties.map(p => html`
              <${Card} key=${p.id} onClick=${() => {setActive(p.id);setTab('overview');}} style=${{cursor:'pointer'}}>
                <div style=${{fontWeight:700,fontSize:17,color:C.text}}>${p.name}</div>
                <div style=${{fontSize:13,color:C.textMuted,marginTop:4}}>
                  📅 ${fmt(p.date)} · 📍 ${p.venue || 'Venue TBD'}
                  · 👥 ${(p.guests || []).length || p.guestCount || 0}
                </div>
                <div style=${{fontSize:12,color:C.sage,marginTop:6}}>
                  ${(p.checklist || []).filter(x => x.done).length}/${(p.checklist || []).length} tasks done
                </div>
              <//>
            `)}
            ${data.parties.length === 0 && html`
              <${Card}><p style=${{textAlign:'center',color:C.textMuted}}>Create your first party.</p><//>`}
          </div>

          <${Modal} title=${edit ? 'Edit Party' : 'New Party'} open=${modal} onClose=${() => setModal(false)}>
            <div style=${{display:'flex',flexDirection:'column',gap:12}}>
              <${Inp} label="Party / Event" value=${f.name || ''} onChange=${v => setF({...f,name:v})}/>
              <div style=${{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <${Inp} label="Date" type="date" value=${f.date || ''} onChange=${v => setF({...f,date:v})}/>
                <${Inp} label="Venue" value=${f.venue || ''} onChange=${v => setF({...f,venue:v})}/>
              </div>
              <div style=${{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <${Inp} label="Theme" value=${f.theme || ''} onChange=${v => setF({...f,theme:v})}/>
                <${Inp} label="Budget" type="number" value=${f.budget || ''} onChange=${v => setF({...f,budget:v})}/>
              </div>
              <${Txa} label="Notes" value=${f.notes || ''} onChange=${v => setF({...f,notes:v})}/>
              <div style=${{display:'flex',justifyContent:'flex-end',gap:8}}>
                <${Btn} variant="outline" onClick=${() => setModal(false)}>Cancel<//>
                <${Btn} onClick=${save}>Save<//>
              </div>
            </div>
          <//>
        </div>
      `;

      const tabs = [
        ['overview','🏠 Overview'],['guests','👥 Guests'],['tasks','✅ Tasks'],
        ['schedule','🕒 Schedule'],['menu','🍽 Menu'],['vendors','🤝 Vendors'],
        ['decor','🎈 Decor'],['activities','🎯 Activities'],['shopping','🛒 Shopping'],
        ['budget','💰 Budget'],['favors','🎁 Favors'],['files','📎 Files & Inspiration']
      ];

      return html`
        <div>
          <${Btn} variant="ghost" onClick=${() => setActive(null)}>← Parties<//>

          <div style=${{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:10,margin:'8px 0 12px'}}>
            <div>
              <h2 style=${{margin:0,fontSize:22,color:C.text}}>${at.name}</h2>
              <div style=${{fontSize:13,color:C.textMuted}}>
                ${fmt(at.date)} · ${at.venue || 'Venue TBD'}${at.theme ? ` · ${at.theme}` : ''}
              </div>
            </div>
            <div style=${{display:'flex',gap:6}}>
              <${Btn} variant="outline" small onClick=${() => open(at)}>Edit<//>
              <${Btn} danger small onClick=${delP}>Delete<//>
            </div>
          </div>

          <${Tabs} tabs=${tabs} value=${tab} onChange=${setTab}/>

          ${tab === 'overview' && html`
            <div style=${{display:'grid',gap:10}}>
              <${Card}>
                <div style=${{fontWeight:700,marginBottom:5}}>Planning notes</div>
                <div style=${{fontSize:13,color:C.textMuted,whiteSpace:'pre-wrap'}}>${at.notes || 'No notes yet.'}</div>
              <//>
              <div style=${{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))',gap:8}}>
                ${[
                  ['Guests',(at.guests || []).length],
                  ['Open tasks',(at.checklist || []).filter(x => !x.done).length],
                  ['Menu',(at.menu || []).length],
                  ['Vendors',(at.vendors || []).length],
                  ['Shopping',(at.shopping || []).filter(x => !x.bought).length]
                ].map(([l,v]) => html`
                  <${Card} key=${l} style=${{padding:'12px'}}>
                    <div style=${{fontSize:20,fontWeight:700,color:C.sage}}>${v}</div>
                    <div style=${{fontSize:12,color:C.textMuted}}>${l}</div>
                  <//>
                `)}
              </div>
            </div>
          `}

          ${tab === 'guests' && html`
            <${CrudList} title="Guest" items=${at.guests || []}
              onChange=${v => setP('guests',v)} area=${`parties/${at.id}/guests`}
              fields=${[
                {key:'name',label:'Name',required:true},
                {key:'group',label:'Family / group'},
                {key:'adults',label:'Adults',type:'number'},
                {key:'kids',label:'Kids',type:'number'},
                {key:'status',label:'RSVP',type:'select',options:['Invited','Yes','No','Maybe']},
                {key:'notes',label:'Notes',type:'textarea'}
              ]}/>
          `}

          ${tab === 'tasks' && html`
            <${CrudList} title="Planning task" items=${at.checklist || []}
              onChange=${v => setP('checklist',v)} area=${`parties/${at.id}/tasks`}
              fields=${[
                {key:'item',label:'Task',required:true},
                {key:'dueDate',label:'Due',type:'date'},
                {key:'owner',label:'Owner'},
                {key:'done',label:'Done',type:'checkbox'},
                {key:'notes',label:'Notes',type:'textarea'}
              ]}/>
          `}

          ${tab === 'schedule' && html`
            <${CrudList} title="Schedule item" items=${at.schedule || []}
              onChange=${v => setP('schedule',v)} area=${`parties/${at.id}/schedule`}
              fields=${[
                {key:'item',label:'Activity / moment',required:true},
                {key:'time',label:'Time',type:'time'},
                {key:'owner',label:'Owner'},
                {key:'location',label:'Area / location'},
                {key:'notes',label:'Notes',type:'textarea'}
              ]}/>
          `}

          ${tab === 'menu' && html`
            <${CrudList} title="Menu item" items=${at.menu || []}
              onChange=${v => setP('menu',v)} area=${`parties/${at.id}/menu`}
              fields=${[
                {key:'item',label:'Dish / drink',required:true},
                {key:'course',label:'Category',type:'select',options:['Breakfast','Snack','Starter','Main','Side','Dessert','Drink','Other']},
                {key:'quantity',label:'Quantity / serves'},
                {key:'vendor',label:'Vendor / homemade'},
                {key:'status',label:'Status',type:'select',options:['Idea','Decided','Ordered','Ready']},
                {key:'notes',label:'Notes',type:'textarea'}
              ]}/>
          `}

          ${tab === 'vendors' && html`
            <${CrudList} title="Vendor" items=${at.vendors || []}
              onChange=${v => setP('vendors',v)} area=${`parties/${at.id}/vendors`}
              fields=${[
                {key:'name',label:'Vendor',required:true},
                {key:'category',label:'Category'},
                {key:'contact',label:'Contact'},
                {key:'cost',label:'Cost',type:'number'},
                {key:'paid',label:'Paid',type:'checkbox'},
                {key:'url',label:'Link',type:'url'},
                {key:'notes',label:'Notes',type:'textarea'}
              ]}/>
          `}

          ${tab === 'decor' && html`
            <${CrudList} title="Decor item" items=${at.decor || []}
              onChange=${v => setP('decor',v)} area=${`parties/${at.id}/decor`}
              fields=${[
                {key:'item',label:'Decor item',required:true},
                {key:'area',label:'Area'},
                {key:'quantity',label:'Qty'},
                {key:'done',label:'Ready',type:'checkbox'},
                {key:'url',label:'Reference link',type:'url'},
                {key:'notes',label:'Notes',type:'textarea'}
              ]}/>
          `}

          ${tab === 'activities' && html`
            <${CrudList} title="Activity / game" items=${at.activities || []}
              onChange=${v => setP('activities',v)} area=${`parties/${at.id}/activities`}
              fields=${[
                {key:'item',label:'Activity',required:true},
                {key:'audience',label:'For whom'},
                {key:'owner',label:'Owner'},
                {key:'done',label:'Ready',type:'checkbox'},
                {key:'notes',label:'Rules / notes',type:'textarea'}
              ]}/>
          `}

          ${tab === 'shopping' && html`
            <${CrudList} title="Shopping item" items=${at.shopping || []}
              onChange=${v => setP('shopping',v)} area=${`parties/${at.id}/shopping`}
              fields=${[
                {key:'item',label:'Item',required:true},
                {key:'category',label:'Category'},
                {key:'quantity',label:'Qty'},
                {key:'budget',label:'Budget',type:'number'},
                {key:'bought',label:'Bought',type:'checkbox'},
                {key:'url',label:'Link',type:'url'},
                {key:'notes',label:'Notes',type:'textarea'}
              ]}/>
          `}

          ${tab === 'budget' && html`
            <${CrudList} title="Party expense" items=${at.expenses || []}
              onChange=${v => setP('expenses',v)} area=${`parties/${at.id}/expenses`}
              fields=${[
                {key:'description',label:'Expense',required:true},
                {key:'category',label:'Category'},
                {key:'amount',label:'Amount',type:'number'},
                {key:'paid',label:'Paid',type:'checkbox'},
                {key:'notes',label:'Notes',type:'textarea'}
              ]}/>
          `}

          ${tab === 'favors' && html`
            <${CrudList} title="Favor / return gift" items=${at.favors || []}
              onChange=${v => setP('favors',v)} area=${`parties/${at.id}/favors`}
              fields=${[
                {key:'item',label:'Gift / favor',required:true},
                {key:'forWhom',label:'For whom'},
                {key:'quantity',label:'Qty'},
                {key:'ready',label:'Ready',type:'checkbox'},
                {key:'url',label:'Link',type:'url'},
                {key:'notes',label:'Notes',type:'textarea'}
              ]}/>
          `}

          ${tab === 'files' && html`
            <${CrudList} title="File / inspiration" items=${at.files || []}
              onChange=${v => setP('files',v)} area=${`parties/${at.id}/files`}
              fields=${[
                {key:'title',label:'Title',required:true},
                {key:'category',label:'Category',type:'select',options:['Invitation','Decor inspiration','Menu','Vendor quote','Venue','Photo','Other']},
                {key:'url',label:'Link',type:'url'},
                {key:'notes',label:'Notes',type:'textarea'},
                {key:'attachments',label:'Files / photos',type:'attachments'}
              ]}/>
          `}

          <${Modal} title="Edit Party" open=${modal} onClose=${() => setModal(false)}>
            <div style=${{display:'flex',flexDirection:'column',gap:12}}>
              <${Inp} label="Party / Event" value=${f.name || ''} onChange=${v => setF({...f,name:v})}/>
              <div style=${{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <${Inp} label="Date" type="date" value=${f.date || ''} onChange=${v => setF({...f,date:v})}/>
                <${Inp} label="Venue" value=${f.venue || ''} onChange=${v => setF({...f,venue:v})}/>
              </div>
              <div style=${{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
                <${Inp} label="Theme" value=${f.theme || ''} onChange=${v => setF({...f,theme:v})}/>
                <${Inp} label="Budget" type="number" value=${f.budget || ''} onChange=${v => setF({...f,budget:v})}/>
              </div>
              <${Txa} label="Notes" value=${f.notes || ''} onChange=${v => setF({...f,notes:v})}/>
              <div style=${{display:'flex',justifyContent:'flex-end',gap:8}}>
                <${Btn} variant="outline" onClick=${() => setModal(false)}>Cancel<//>
                <${Btn} onClick=${save}>Save<//>
              </div>
            </div>
          <//>
        </div>
      `;
    }

    function BabyCorner({ data, updateData }) {
      const [mode,setMode] = useState('hub');
      const resources = Array.isArray(data.baby?.resources) ? data.baby.resources : [];

      useEffect(() => {
        if (!data.baby?.resourceLinksSeeded) {
          const seeded = [
            {
              id:'baby-prep-sheet',
              title:'Baby Prep Master Sheet',
              category:'Baby Prep',
              url:'https://docs.google.com/spreadsheets/d/1NRANoJh4DoPP0CpwoBnqbMCyNaly0RFf848txI4-BBw/edit?usp=sharing',
              notes:'Original planning sheet reference',
              attachments:[]
            },
            {
              id:'solids-sheet',
              title:'Solids Introduction Sheet',
              category:'Solids',
              url:'https://docs.google.com/spreadsheets/d/1Fmd2VqBlZORWGnu_7R3puiJRP-jq4DjrE5Q9QvStfuM/edit?usp=sharing',
              notes:'Original solids sheet reference',
              attachments:[]
            }
          ];
          updateData({
            baby:{
              ...data.baby,
              resources:[...resources,...seeded.filter(s => !resources.some(r => r.id === s.id))],
              resourceLinksSeeded:true
            }
          });
        }
      },[]);

      const setResources = v => updateData({
        baby:{...data.baby,resources:v,resourceLinksSeeded:true}
      });

      const filtered = mode === 'prep'
        ? resources.filter(r => r.category === 'Baby Prep')
        : resources;

      return html`
        <div>
          <div style=${{display:'flex',gap:6,marginBottom:14,overflowX:'auto'}}>
            <button onClick=${() => setMode('hub')} style=${tabStyle(mode === 'hub')}>👶 Child Hub</button>
            <button onClick=${() => setMode('prep')} style=${tabStyle(mode === 'prep')}>🍼 Baby Prep</button>
            <button onClick=${() => setMode('resources')} style=${tabStyle(mode === 'resources')}>📚 Files & Sheets</button>
          </div>

          ${mode === 'hub' && html`<${LegacyBabyCorner} data=${data} updateData=${updateData}/>`}

          ${mode !== 'hub' && html`
            <div>
              <div style=${{background:C.purpleLt,borderRadius:10,padding:'10px 12px',fontSize:13,color:C.purple,marginBottom:12}}>
                Upload Excel/CSV, PDFs, Word docs and photos, or keep a link to a Google Sheet.
                Use categories so lessons, solids, baby prep and other resources stay organized.
              </div>

              <${CrudList}
                title=${mode === 'prep' ? 'Baby Prep resource' : 'Child resource'}
                items=${filtered}
                onChange=${v => {
                  if (mode === 'prep') {
                    const other = resources.filter(r => r.category !== 'Baby Prep');
                    setResources([...other,...v.map(x => ({...x,category:'Baby Prep'}))]);
                  } else {
                    setResources(v);
                  }
                }}
                area="baby-resources"
                fields=${[
                  {key:'title',label:'Title',required:true},
                  {key:'category',label:'Category',type:'select',options:['Baby Prep','Solids','Lessons','Activities','Health','Montessori','Milestones','Other']},
                  {key:'url',label:'Google Sheet / web link',type:'url'},
                  {key:'notes',label:'Notes',type:'textarea'},
                  {key:'attachments',label:'Files',type:'attachments'}
                ]}
              />
            </div>
          `}
        </div>
      `;
    }

    return { CalendarSection, Trips, Parties, BabyCorner, UniversalAttachments };
  };
})();
