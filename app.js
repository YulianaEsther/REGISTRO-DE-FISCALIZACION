(() => {
'use strict';
const DB_NAME='fiscalizacionDB_v1', STORE='projects';
let db, activeId=null, photos=[], pendingFiles=[], currentProject=null;
const $=id=>document.getElementById(id);
const fields=['code','date','place','inspector','establishment'];
function msg(id,text,type='success'){const el=$(id);el.textContent=text;el.className='status show '+(type==='error'?'error':'success');}
function hideMsg(id){$(id).className='status';}
function uuid(){return (crypto&&crypto.randomUUID)?crypto.randomUUID():'id-'+Date.now()+'-'+Math.random().toString(16).slice(2);}
function openDB(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE,{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
function tx(mode='readonly'){return db.transaction(STORE,mode).objectStore(STORE);}
function allProjects(){return new Promise((resolve,reject)=>{const r=tx().getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);});}
function putProject(p){return new Promise((resolve,reject)=>{const r=tx('readwrite').put(p);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});}
function removeProject(id){return new Promise((resolve,reject)=>{const r=tx('readwrite').delete(id);r.onsuccess=()=>resolve();r.onerror=()=>reject(r.error);});}
function formData(){const p={};fields.forEach(k=>p[k]=$(k).value.trim());return p;}
function fillForm(p){fields.forEach(k=>$(k).value=p?.[k]||'');}
function clearForm(){fillForm({date:new Date().toISOString().slice(0,10)});}
async function refreshProjects(){const list=await allProjects();const sel=$('savedProjects');sel.innerHTML='<option value="">Crear nuevo proyecto…</option>';list.sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)).forEach(p=>{const o=document.createElement('option');o.value=p.id;o.textContent=(p.code||'Sin código')+' — '+(p.establishment||'Sin establecimiento');sel.appendChild(o);});if(activeId)sel.value=activeId;}

async function mostrarTodosLosProyectos() {
  const proyectos = await allProjects();
  const contenedor =
    document.getElementById("listaProyectos");

  contenedor.replaceChildren();

  if (proyectos.length === 0) {
    contenedor.textContent =
      "No hay proyectos guardados todavía.";
    return;
  }

  proyectos.forEach(function(proyecto) {
    const tarjeta = document.createElement("article");
    tarjeta.className = "proyecto-tarjeta";

    const titulo = document.createElement("h3");
    titulo.textContent =
      proyecto.code + " — " + proyecto.establishment;
    tarjeta.appendChild(titulo);

    const datos = document.createElement("p");
    datos.textContent =
      "Fecha: " + proyecto.date +
      " | Lugar: " + proyecto.place +
      " | Fiscalizador: " + proyecto.inspector;
    tarjeta.appendChild(datos);

    const galeria = document.createElement("div");
    galeria.className = "proyecto-fotos";

    (proyecto.photos || []).forEach(function(foto, i) {
      const imagen = document.createElement("img");
      imagen.src = foto.data;
      imagen.alt = "Fotografía " + (i + 1);
      galeria.appendChild(imagen);
    });

    tarjeta.appendChild(galeria);

    const botonAbrir = document.createElement("button");
    botonAbrir.type = "button";
    botonAbrir.textContent = "Abrir proyecto";

    botonAbrir.addEventListener("click", async function() {
      document.getElementById("savedProjects").value =
        proyecto.id;
      await openSelected();
    });

    tarjeta.appendChild(botonAbrir);
    contenedor.appendChild(tarjeta);
  });
}

function requireProject(){if(!activeId){msg('photoStatus','Primero guarda o abre un proyecto antes de agregar fotografías.','error');return false;}return true;}
async function saveCurrent(silent=false){const data=formData();if(fields.some(k=>!data[k])){if(!silent)msg('projectStatus','Completa todos los campos obligatorios marcados con *.','error');return false;}
const old=activeId?await getProject(activeId):null;activeId=activeId||uuid();const p={...(old||{}),...data,id:activeId,photos,updatedAt:Date.now(),createdAt:old?.createdAt||Date.now()};await putProject(p);currentProject=p;await refreshProjects();if(!silent)msg('projectStatus','Proyecto guardado. Se conservarán sus fotografías en este navegador.');return true;}
function getProject(id){return new Promise((resolve,reject)=>{const r=tx().get(id);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});}
async function openSelected(){const id=$('savedProjects').value;if(!id){msg('projectStatus','Selecciona un proyecto guardado.','error');return;}const p=await getProject(id);if(!p){msg('projectStatus','No se encontró el proyecto.','error');return;}activeId=p.id;currentProject=p;photos=p.photos||[];fillForm(p);renderPhotos();await refreshProjects();msg('projectStatus','Proyecto abierto con '+photos.length+' fotografía(s).');}
function newProject(){activeId=null;currentProject=null;photos=[];clearForm();renderPhotos();$('savedProjects').value='';hideMsg('projectStatus');msg('projectStatus','Formulario nuevo. Guarda el proyecto antes de añadir fotografías.');}
function fileToData(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=()=>reject(new Error('No se pudo leer la imagen.'));r.readAsDataURL(file);});}
function resetPending(){pendingFiles=[];$('cameraInput').value='';$('galleryInput').value='';$('capturePreview').classList.remove('show');$('previewList').innerHTML='';$('newDescription').value='';}
async function handleFiles(fileList){hideMsg('photoStatus');if(!requireProject())return;const files=[...fileList].filter(f=>f.type.startsWith('image/'));if(!files.length){msg('photoStatus','No se seleccionó una imagen válida. Puedes intentarlo de nuevo.','error');return;}try{pendingFiles=await Promise.all(files.map(async file=>({file,data:await fileToData(file)})));$('previewList').innerHTML='';pendingFiles.forEach((p,i)=>{const wrap=document.createElement('div');wrap.style.marginBottom='10px';const im=document.createElement('img');im.src=p.data;im.alt='Vista previa '+(i+1);const cap=document.createElement('div');cap.className='muted';cap.textContent=p.file.name||('Fotografía '+(i+1));wrap.append(im,cap);$('previewList').appendChild(wrap);});$('newDescription').value='';$('capturePreview').classList.add('show');if(pendingFiles.length>1)msg('photoStatus','Se seleccionaron '+pendingFiles.length+' imágenes. Se incorporarán con la misma descripción; puedes editar cada una después.');}catch(e){msg('photoStatus','No se pudo preparar la imagen: '+e.message,'error');}}
async function confirmPhotos(){if(!requireProject()||!pendingFiles.length)return;const desc=$('newDescription').value.trim();const now=new Date().toISOString();pendingFiles.forEach(p=>photos.push({id:uuid(),data:p.data,mime:p.file.type||'image/jpeg',description:desc,addedAt:now,filename:p.file.name||'fotografia'}));resetPending();renderPhotos();await saveCurrent(true);msg('photoStatus','Fotografía(s) incorporada(s) y guardada(s): '+photos.length+' en total.');}
function renderPhotos(){const grid=$('photoGrid');grid.innerHTML='';if(!photos.length){grid.innerHTML='<div class="empty" style="grid-column:1/-1">Todavía no hay fotografías en este proyecto.</div>';return;}
photos.forEach((p,i)=>{const card=document.createElement('article');card.className='photo-card';const img=document.createElement('img');img.src=p.data;img.alt='Fotografía '+(i+1);const content=document.createElement('div');content.className='photo-content';const num=document.createElement('div');num.className='photo-number';num.textContent='Fotografía '+String(i+1).padStart(2,'0');const meta=document.createElement('div');meta.className='photo-meta';const d=new Date(p.addedAt);meta.textContent='Incorporada: '+(isNaN(d)?'No disponible':d.toLocaleString('es-PE'));const lab=document.createElement('label');lab.textContent='Descripción';lab.htmlFor='desc-'+p.id;const ta=document.createElement('textarea');ta.id='desc-'+p.id;ta.value=p.description||'';ta.placeholder='Escribe una descripción…';ta.addEventListener('change',async()=>{p.description=ta.value;await saveCurrent(true);msg('photoStatus','Descripción actualizada.');});const acts=document.createElement('div');acts.className='photo-actions';const up=button('↑ Subir','secondary',()=>movePhoto(i,-1));up.disabled=i===0;const down=button('↓ Bajar','secondary',()=>movePhoto(i,1));down.disabled=i===photos.length-1;const del=button('Eliminar','danger',()=>deletePhoto(i));acts.append(up,down,del);content.append(num,meta,lab,ta,acts);card.append(img,content);grid.appendChild(card);});}
function button(text,cls,fn){const b=document.createElement('button');b.type='button';b.textContent=text;b.className=cls;b.addEventListener('click',fn);return b;}
async function movePhoto(i,delta){const j=i+delta;if(j<0||j>=photos.length)return;[photos[i],photos[j]]=[photos[j],photos[i]];renderPhotos();await saveCurrent(true);msg('photoStatus','Orden actualizado y guardado.');}
async function deletePhoto(i){if(!confirm('¿Eliminar esta fotografía del anexo? Esta acción no se puede deshacer.'))return;photos.splice(i,1);renderPhotos();await saveCurrent(true);msg('photoStatus','Fotografía eliminada y cambios guardados.');}
function dataUrlBytes(data){const b64=data.split(',')[1];const bin=atob(b64);const arr=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);return arr;}
function imageType(mime,data){if(mime==='image/png'||data.startsWith('data:image/png'))return 'png';if(mime==='image/gif'||data.startsWith('data:image/gif'))return 'gif';return 'jpg';}
async function exportWord(){hideMsg('exportStatus');if(!activeId){msg('exportStatus','Guarda o abre un proyecto antes de exportar.','error');return;}if(!photos.length){msg('exportStatus','Añade al menos una fotografía para generar el anexo.','error');return;}if(!window.docx){msg('exportStatus','No se pudo cargar la biblioteca de Word. Comprueba tu conexión a internet y vuelve a intentarlo.','error');return;}try{await saveCurrent(true);const {Document,Packer,Paragraph,TextRun,HeadingLevel,AlignmentType,ImageRun,PageBreak}=window.docx;const p=formData();const children=[];
children.push(new Paragraph({text:'ANEXO FOTOGRÁFICO',heading:HeadingLevel.TITLE,alignment:AlignmentType.CENTER,spacing:{after:300}}));
[['Código de práctica',p.code],['Fecha de intervención',p.date],['Lugar',p.place],['Fiscalizador',p.inspector],['Establecimiento o unidad',p.establishment]].forEach(([label,value])=>children.push(new Paragraph({children:[new TextRun({text:label+': ',bold:true}),new TextRun(value||'—')],spacing:{after:100}})));
children.push(new Paragraph({text:'Registro fotográfico',heading:HeadingLevel.HEADING_1,spacing:{before:300,after:200}}));
for(let i=0;i<photos.length;i++){const ph=photos[i];children.push(new Paragraph({children:[new TextRun({text:'Fotografía '+String(i+1).padStart(2,'0'),bold:true,size:26})],spacing:{before:220,after:100}}));if(ph.data){const bytes=dataUrlBytes(ph.data);const typ=imageType(ph.mime,ph.data);const img=new ImageRun({data:bytes,transformation:{width:460,height:300},type:typ});children.push(new Paragraph({children:[img],alignment:AlignmentType.CENTER,spacing:{after:100}}));}children.push(new Paragraph({children:[new TextRun({text:'Descripción: ',bold:true}),new TextRun(ph.description||'Sin descripción')],spacing:{after:180}}));children.push(new Paragraph({children:[new TextRun({text:'Fecha y hora de incorporación en la aplicación: ',bold:true}),new TextRun(ph.addedAt?new Date(ph.addedAt).toLocaleString('es-PE'):'No disponible')],spacing:{after:180}}));}
const doc=new Document({sections:[{properties:{page:{margin:{top:850,right:850,bottom:850,left:850}}},children}]});const blob=await Packer.toBlob(doc);const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='Anexo_fotografico_'+(p.code.replace(/[^a-z0-9_-]/gi,'_')||'fiscalizacion')+'.docx';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);msg('exportStatus','Documento .docx generado. Ábrelo en Microsoft Word o en una aplicación compatible. Las imágenes están incrustadas y el orden coincide con la galería.');}catch(e){console.error(e);msg('exportStatus','Error al generar el Word: '+(e.message||'error desconocido')+'. Prueba con imágenes JPG o PNG.','error');}}
$('saveProject').addEventListener('click',()=>saveCurrent().catch(e=>msg('projectStatus','No se pudo guardar: '+e.message,'error')));
$('openProject').addEventListener('click',()=>openSelected().catch(e=>msg('projectStatus','No se pudo abrir el proyecto: '+e.message,'error')));
$('newProject').addEventListener('click',newProject);

$('verProyectos').addEventListener('click', () => {
  mostrarTodosLosProyectos().catch(error => {
    console.error(error);
    alert('No se pudieron cargar los proyectos guardados.');
  });
});

$('deleteProject').addEventListener('click',async()=>{if(!activeId){msg('projectStatus','No hay un proyecto activo para eliminar.','error');return;}if(!confirm('¿Eliminar el proyecto y todas sus fotografías guardadas?'))return;try{await removeProject(activeId);activeId=null;currentProject=null;photos=[];clearForm();renderPhotos();await refreshProjects();msg('projectStatus','Proyecto eliminado.');}catch(e){msg('projectStatus','No se pudo eliminar: '+e.message,'error');}});
$('cameraInput').addEventListener('change',e=>{if(e.target.files?.length)handleFiles(e.target.files);else msg('photoStatus','La cámara se canceló o no se seleccionó una foto. Puedes volver a intentarlo o elegir una imagen de la galería.','error');});
$('galleryInput').addEventListener('change',e=>{if(e.target.files?.length)handleFiles(e.target.files);else msg('photoStatus','No se seleccionó ninguna imagen. Puedes intentarlo de nuevo.','error');});
$('confirmPhoto').addEventListener('click',()=>confirmPhotos().catch(e=>msg('photoStatus','No se pudo guardar la fotografía: '+e.message,'error')));
$('cancelPhoto').addEventListener('click',()=>{resetPending();msg('photoStatus','Incorporación cancelada. No se añadió ninguna fotografía.');});
$('exportWord').addEventListener('click',exportWord);
(async()=>{try{if(!('indexedDB'in window))throw new Error('Este navegador no admite IndexedDB.');db=await openDB();await refreshProjects();clearForm();renderPhotos();}catch(e){msg('projectStatus','No se pudo iniciar el almacenamiento local: '+e.message,'error');}})();
})();
