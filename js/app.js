/* estado global */
let tabla;
let celdaEditando = null;
let modoCopia = false;            // true = seleccionar celdas destino
let modoSeleccionPlatos = false;  // true = seleccionar platos a copiar
let platosSeleccionados = [];     // array {plato,rowId,field}

/* datos base (simulados por combinación hotel+rueda) */
const sampleData = {
  "Hotel1|2026_desayuno":[
    { _id:1, estacion:"Frío", L:["Yogur","Fruta"], M:[], X:[], J:["Tostadas"], V:[], S:[], D:[] },
    { _id:2, estacion:"Caliente", L:["Huevos revueltos"], M:["Sopa"], X:[], J:[], V:[], S:[], D:[] },
    { _id:3, estacion:"Postres", L:["Croissant"], M:[], X:[], J:[], V:[], S:[], D:[] }
  ],
  "Hotel1|2026_almuerzo":[
    { _id:1, estacion:"Frío", L:[], M:["Ensalada"], X:[], J:[], V:["Gazpacho"], S:[], D:[] },
    { _id:2, estacion:"Caliente", L:["Pollo asado"], M:["Paella"], X:[], J:[], V:[], S:[], D:[] },
    { _id:3, estacion:"Postres", L:["Fruta"], M:[], X:[], J:[], V:[], S:[], D:[] }
  ],
  "Hotel1|2026_cena":[
    { _id:1, estacion:"Frío", L:[], M:[], X:[], J:["Ensalada Cesar"], V:[], S:[], D:[] },
    { _id:2, estacion:"Caliente", L:[], M:[], X:["Pescado"], J:[], V:["Pasta"], S:[], D:[] },
    { _id:3, estacion:"Postres", L:[], M:[], X:[], J:[], V:[], S:["Helado"], D:[] }
  ],
  "Hotel2|2026_desayuno":[
    { _id:1, estacion:"Frío", L:["Batido"], M:[], X:[], J:[], V:[], S:[], D:[] },
    { _id:2, estacion:"Caliente", L:["Tortilla"], M:[], X:[], J:[], V:[], S:[], D:[] }
  ],
  "Hotel2|2026_almuerzo":[
    { _id:1, estacion:"Frío", L:[], M:["Ensalada Especial"], X:[], J:[], V:[], S:[], D:[] },
    { _id:2, estacion:"Caliente", L:["Lasaña"], M:["Estofado"], X:[], J:[], V:[], S:[], D:[] }
  ],
  "Hotel2|2026_cena":[
    { _id:1, estacion:"Frío", L:[], M:[], X:[], J:[], V:["Sushi"], S:[], D:[] },
    { _id:2, estacion:"Caliente", L:[], M:[], X:["Solomillo"], J:[], V:[], S:[], D:[] }
  ],
};

/* helper */
function ensureArr(v){ return Array.isArray(v) ? v : (v ? [v] : []); }

/* renderer celdas (platos) */
function renderPlatos(cell){
  const val = ensureArr(cell.getValue());
  const container = document.createElement("div");
  container.className = "cell-inner" + (val.length===0 ? " empty" : "");
  container.style.paddingBottom = "56px"; // espacio suficiente para add button

  // add button (floating)
  const addBtn = document.createElement("button");
  addBtn.className = "add-plato";
  addBtn.title = "Añadir plato";
  addBtn.innerText = "+";
  addBtn.addEventListener("click",(e)=>{ e.stopPropagation(); celdaEditando = cell; mostrarBuscador(cell); });
  container.appendChild(addBtn);

  // one-time bind drop handlers on the cell element
  const cellEl = cell.getElement();
  if(!cellEl._dropBound){
    cellEl.addEventListener("dragover", e=> e.preventDefault());
    cellEl.addEventListener("drop", e=>{
      e.preventDefault();
      try{
        const raw = e.dataTransfer.getData("application/json");
        if(!raw) return;
        const data = JSON.parse(raw);
        if(!data?.plato) return;
        // destination
        const dest = ensureArr(cell.getValue());
        if(!dest.includes(data.plato)) dest.push(data.plato);
        cell.setValue(dest);
        // remove from origin
        const originRow = tabla.getRow(data.rowId);
        if(originRow){
          const originCell = originRow.getCell(data.field);
          const originVal = ensureArr(originCell.getValue()).filter(p=>p!==data.plato);
          originCell.setValue(originVal);
        }
        
        cell.getRow().reformat();
        tabla.redraw(true);
      }catch(err){ console.error(err); }
    });
    cellEl._dropBound = true;
  }

  // render platos
  val.forEach(plato=>{
    const row = document.createElement("div");
    row.className = "plato-row";

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.style.marginRight = "8px";
    chk.style.display = modoSeleccionPlatos ? "inline-block" : "none";
    chk.addEventListener("change", e=>{
      if(e.target.checked) platosSeleccionados.push({plato, rowId: cell.getRow().getIndex(), field: cell.getField()});
      else platosSeleccionados = platosSeleccionados.filter(p=>!(p.plato===plato && p.rowId===cell.getRow().getIndex() && p.field===cell.getField()));
    });

    const txt = document.createTextNode(plato);

    const removeBtn = document.createElement("button");
    removeBtn.className = "remove";
    removeBtn.innerText = "×";
    removeBtn.title = "Eliminar plato";
    removeBtn.addEventListener("click", e=>{
      e.stopPropagation();
      if(confirm(`Eliminar plato "${plato}"?`)){
        const newVal = ensureArr(cell.getValue()).filter(p=>p!==plato);
        cell.setValue(newVal);
        cell.getRow().reformat();
        tabla.redraw(true);
      }
    });

    // drag behavior: hold 100ms to enable drag
    let timer = null;
    row.addEventListener("mousedown", e=>{
      e.stopPropagation();
      timer = setTimeout(()=> row.setAttribute("draggable","true"), 100);
    });
    row.addEventListener("mouseup", e=>{ clearTimeout(timer); row.removeAttribute("draggable"); });
    row.addEventListener("mouseleave", e=>{ clearTimeout(timer); row.removeAttribute("draggable"); });

    row.addEventListener("dragstart", e=>{
      const payload = { plato, rowId: cell.getRow().getData()._id, field: cell.getField() };
      e.dataTransfer.setData("application/json", JSON.stringify(payload));
      row.classList.add("dragging");
    });
    
    row.addEventListener("dragend", e=>{ row.classList.remove("dragging"); row.removeAttribute("draggable"); });

    row.appendChild(chk);
    row.appendChild(txt);
    row.appendChild(removeBtn);
    container.appendChild(row);
  });

  // in paste-selection mode show a small checkbox on cell
  if(modoCopia){
    const c = document.createElement("input");
    c.type = "checkbox";
    c.className = "cell-select";
    c.addEventListener("change", e=>{ cell.selectedParaPegar = e.target.checked; });
    container.appendChild(c);
  }

  return container;
}

/* buscador (prompt provisional) */
function mostrarBuscador(cell){
  const nombre = prompt("Buscar/añadir plato (escribe nombre):");
  if(!nombre) return;
  const arr = ensureArr(cell.getValue());
  if(!arr.includes(nombre)) arr.push(nombre);
  cell.setValue(arr);
  cell.getRow().reformat();
  tabla.redraw(true);
}

/* inicializar Tabulator */
tabla = new Tabulator("#tabla", {
  data: sampleData["Hotel1|2026_desayuno"], // default
  layout: "fitColumns",
  reactiveData:true,
  movableRows:true,
  movableRowsHandle: ".handle-icon",
  columns:[
    { title:"Estación", field:"estacion", width:160, hozAlign:"left", headerSort:false, formatter:function(cell){
        const el = document.createElement("div");
        el.className = "handle-cell";
        const handle = document.createElement("span");
        handle.className = "handle-icon";
        handle.innerText = "≡";
        const lbl = document.createElement("span");
        lbl.style.flex = "1";
        lbl.style.fontWeight = "600";
        lbl.innerText = cell.getValue();
        el.appendChild(handle);
        el.appendChild(lbl);
        return el;
    }, frozen:true },
    { title:"L", field:"L", formatter:renderPlatos },
    { title:"M", field:"M", formatter:renderPlatos },
    { title:"X", field:"X", formatter:renderPlatos },
    { title:"J", field:"J", formatter:renderPlatos },
    { title:"V", field:"V", formatter:renderPlatos },
    { title:"S", field:"S", formatter:renderPlatos },
    { title:"D", field:"D", formatter:renderPlatos },
  ],
});

/* UI buttons */
const copiarBtn = document.getElementById("copiarPlatos");
const pegarBtn = document.getElementById("pegarPlatos");
const addEstBtn = document.getElementById("addEstacionBtn");
const hotelSel = document.getElementById("hotelSelector");
const ruedaSel = document.getElementById("ruedaSelector");

copiarBtn.addEventListener("click", ()=>{
  // start or confirm plate selection
  if(!modoSeleccionPlatos && !modoCopia){
    modoSeleccionPlatos = true;
    platosSeleccionados = [];
    copiarBtn.innerText = "Confirmar copia";
    alert("Selecciona los platos marcando sus checkboxes y pulsa Confirmar copia.");
    tabla.redraw(true);
    return;
  }
  if(modoSeleccionPlatos && !modoCopia){
    if(platosSeleccionados.length === 0){
      alert("No has seleccionado platos. Marca checkboxes antes de confirmar.");
      return;
    }
    // move to cell-selection mode
    modoSeleccionPlatos = false;
    modoCopia = true;
    copiarBtn.innerText = "Seleccionar platos";
    alert("Ahora selecciona las celdas destino (checkbox en esquina) y pulsa 'Pegar contenido'.");
    tabla.redraw(true);
    return;
  }
  // if already in modoCopia pressing again cancels
  if(modoCopia){
    modoCopia = false;
    modoSeleccionPlatos = false;
    platosSeleccionados = [];
    copiarBtn.innerText = "Seleccionar platos";
    tabla.redraw(true);
  }
});

pegarBtn.addEventListener("click", ()=>{
  if(platosSeleccionados.length === 0){
    alert("No hay platos seleccionados para pegar. Primero selecciona y confirma copia.");
    return;
  }
  tabla.getRows().forEach(row=>{
    Object.keys(row.getData()).forEach(field=>{
      if(field === "estacion") return;
      const cell = row.getCell(field);
      if(cell && cell.selectedParaPegar){
        const dest = ensureArr(cell.getValue());
        platosSeleccionados.forEach(p=>{
          if(!dest.includes(p.plato)) dest.push(p.plato);
        });
        cell.setValue(dest);
      }
    });
  });
  // reset
  modoCopia = false;
  modoSeleccionPlatos = false;
  platosSeleccionados = [];
  // clear flags
  tabla.getRows().forEach(r=>{
    Object.keys(r.getData()).forEach(f=>{
      if(f === "estacion") return;
      const c = r.getCell(f);
      if(c) c.selectedParaPegar = false;
    });
  });
  copiarBtn.innerText = "Seleccionar platos";
  tabla.redraw(true);
});

/* añadir estación */
addEstBtn.addEventListener("click", ()=>{
  const nombre = prompt("Nombre de la nueva estación:");
  if(!nombre) return;
  const newRow = { _id: Date.now(), estacion: nombre, L:[], M:[], X:[], J:[], V:[], S:[], D:[] };
  tabla.addRow(newRow, true).then(row=>{
    row.getElement().scrollIntoView({behavior:"smooth", block:"center"});
  });
});

/* cargar datos al cambiar hotel/rueda */
function loadCombination(){
  const key = `${hotelSel.value}|${ruedaSel.value}`;
  const dataset = sampleData[key] || [
    { _id:1, estacion:"Frío", L:[], M:[], X:[], J:[], V:[], S:[], D:[] },
    { _id:2, estacion:"Caliente", L:[], M:[], X:[], J:[], V:[], S:[], D:[] },
  ];
  // reset modes/selection
  modoCopia = false;
  modoSeleccionPlatos = false;
  platosSeleccionados = [];
  copiarBtn.innerText = "Seleccionar platos";
  tabla.setData(dataset);
}
hotelSel.addEventListener("change", loadCombination);

ruedaSel.addEventListener("change", loadCombination);

// --- MENÚ LATERAL ---
document.addEventListener("DOMContentLoaded", () => {

  const btnPlatos = document.getElementById("btnPlatos");
  const btnRuedas = document.getElementById("btnRuedas");

  if (btnPlatos) {
    btnPlatos.addEventListener("click", () => {
      window.open("platos.html", "_blank");
    });
  }

  if (btnRuedas) {
    btnRuedas.addEventListener("click", () => {
      window.open("index.html", "_blank");
    });
  }

});

