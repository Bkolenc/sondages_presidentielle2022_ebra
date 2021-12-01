Object.assign(d3,d3regression);

class Queue {

    constructor() {
        this.queue = [];
        this.workingOnPromise = false;
    }

    enqueue(promise) {
        console.log("enqueue",promise);
        return new Promise((resolve, reject) => {
            this.queue.push({
                promise,
                resolve,
                reject,
            });
            this.dequeue();
        });
    }

    dequeue() {
        if (this.workingOnPromise) {
            return false;
        }
        const item = this.queue.shift();
        if (!item) {
            return false;
        }
        try {
            this.workingOnPromise = true;
            console.log(item);
            item.promise
                .then((value) => {
                    this.workingOnPromise = false;
                    item.resolve(value);
                    this.dequeue();
                })
                .catch(err => {
                    this.workingOnPromise = false;
                    item.reject(err);
                    this.dequeue();
                })
        } catch (err) {
            this.workingOnPromise = false;
            item.reject(err);
            this.dequeue();
        }
        return true;
    }
}

class DataWrapper {

    constructor(id) {
        this.id = id;
        //Propriété privée contenant les données (en pratique, la plupart des méthodes feront appel à this.dataset)
        this._dataset = {full: [], filtered: []};
        //Index pour l'itérateur
        this.index = 0;
        //Collection de fonctions pour la gestion des filtres
        this.filters = {
            list: new Map(),
            add: (id, fn) => {
                this.filters.list.set(id, fn);
                this._dataset.filtered = this._dataset.filtered.filter(fn);
                return this.filters;
            },
            remove: (id) => {
                this.filters.list.delete(id);
                this.filters.execute();
                return this.filters;
            },
            execute: () => {
                this._dataset.filtered = this._dataset.full;
                this.filters.list.forEach((fn) => this._dataset.filtered = this._dataset.filtered.filter(fn));
                return this.filters;
            },
            reset: () => {
                this.filters.list.clear();
                this._dataset.filtered = this._dataset.full;
                return this.filters;
            },
        };
        //Proxy utilisé pour intercepter les requetes (et renvoyer des données filtrées si filters.list n'est pas vide)
        this.proxy = new Proxy(this, {
            set(target, property, value) {
                target[property] = value;
                return true;
            },
            get(target, property, proxy) {
                if (property === 'dataset') {
                    return (target.filters.list.size) ? target._dataset.filtered : target._dataset.full;
                } else return target[property];
            }
        });
        return this.proxy;
    }

    /**
     * Itérateur
     * @returns {{next: ((function(): ({value: *, done: boolean}))|*)}}
     */
    [Symbol.iterator]() {
        return {
            next: () => {
                if (this.index < this.dataset.length) {
                    return {value: this.dataset[this.index++], done: false};
                } else {
                    this.index = 0;
                    return {done: true};
                }
            }
        };
    }

    /**
     * Prépare le chargement en injectant le nom du fichier et les options
     * @param fileName : String|Function : Nom du fichier sous forme de string ou de fonction (dans ce cas il faut une propriété arg dans options)
     * @param options : Object : { delimiter, mapper, path, arg }
     * @returns {DataWrapper}
     */
    prepare(fileName, options) {
        if (typeof fileName == 'function' && typeof options.arg !== 'undefined') fileName = fileName(options.arg);
        const _options = {fileName: fileName, delimiter: ';', mapper: d3.autoType, path: 'data'};
        this.fileOptions = {..._options, ...options};
        return this;
    }


    /**
     * Charge et renvoie les données sous forme de promesse
     * @returns {Promise<unknown>}
     */
    ready() {
        return new Promise((resolve, reject) => {
            d3.text(`${this.fileOptions.path}/${this.fileOptions.fileName}`)
                .then((dataset) => {
                    dataset = d3.dsvFormat(this.fileOptions.delimiter).parse(dataset);
                    dataset = dataset.map(this.fileOptions.mapper);
                    this.push(dataset);
                    resolve(this.dataset);
                });
        });
    }

    /**
     * Initialise l'instance avec un dataset
     * @param dataset : Array
     * @returns {DataWrapper}
     */
    push(dataset) {
        this._dataset.filtered = this._dataset.full = dataset;
        this.keys = Object.keys(dataset[0]);
        return this;
    }

    /**
     * Renvoie un objet Dictionnaire ayant pour clé primaryKey (
     * @param primaryKey : String : si undefined, cherche une propriété this.primary, sinon défini à 'id' par défaut
     * @returns {*} : Map
     */
    convertToDict(primaryKey) {
        return this._convertToObject(primaryKey, 'Dictionary');
    }

    /**
     * Renvoie un objet Map ayant pour clé primaryKey (
     * @param primaryKey : String : si undefined, cherche une propriété this.primary, sinon défini à 'id' par défaut
     * @returns {*} : Map
     */
    convertToMap(primaryKey) {
        return this._convertToObject(primaryKey, 'Map');
    }

    _convertToObject(primaryKey, type = 'Dictionary') {
        primaryKey = (typeof primaryKey !== 'undefined') ? primaryKey :
            (this.hasOwnProperty('primary')) ? this.primary :
                'id';
        const cloneRow = (row) => {
            let clonedRow = Object.assign({}, row);
            delete (clonedRow[primaryKey]);
            return clonedRow;
        }
        return (type === "Map") ?
            new Map(this.dataset.map((row) => [row[primaryKey], cloneRow(row)])) :
            Object.assign({}, ...this.dataset.map((row) => ({[row[primaryKey]]: cloneRow(row)})));

    }

    map(fn) {
        this._dataset.full = this._dataset.full.map(fn);
        return this;
    }

    /**
     * Renvoie les données d'une colonne
     * @param key
     * @returns {*}
     */
    col(key) {
        return this.dataset.map((d) => d[key]);
    }

    /**
     * Renvoie une ligne de données
     * @param id
     * @returns {*}
     */
    row(id) {
        return (this.primary) ? this.dataset.find((d) => d[this.primary] === id) : this.dataset[id];
    }

    /**
     * Cherche et renvoie la ligne de données où key=value
     * @param key
     * @param value
     * @returns {*}
     */
    find(key, value) {
        return this.dataset.find((d) => d[id] === value);
    }

    /**
     * Cherche et renvoie les lignes de données où key=value
     * @param key
     * @param key
     * @param value
     * @returns {*}
     */
    findAll(key, value) {
        return this.dataset.filter((d) => d[id] === value);
    }

    /**
     * Renvoie les valeurs extrêmes d'une colonne
     * @param key : String
     * @returns {*}  [min,max]
     */
    extent(key) {
        let data = this.col(key);
        return d3.extent(data);
    }

    /**
     * Affiche les nb premières lignes des données dans la console
     * @param nb
     * @returns {DataFrame}
     */
    head(nb = 10) {
        return this._sample(0, nb);
    }

    /**
     * Méthode privée appelée par head
     * @param start
     * @param nb
     * @returns {DataFrame}
     * @private
     */
    _sample(start = 0, nb = 10) {
        const extract = this._slice(start, nb),
            lengths = Array(this.keys.length).fill(0);
        console.log(extract);
        extract.unshift(this.keys.reduce((a, v) => ({...a, [v]: v}), {}));
        for (let j = 0; j < this.keys.length; j++) {
            extract.forEach((row, i) => {
                if (extract[i][this.keys[j]] === null) extract[i][this.keys[j]] = 'null';
                else if (extract[i][this.keys[j]] === undefined) extract[i][this.keys[j]] = 'undefined';
                else extract[i][this.keys[j]] = extract[i][this.keys[j]].toString();
                lengths[j] = Math.max(lengths[j], extract[i][this.keys[j]].length);
            });
        }
        let string = "\r\n";
        extract.forEach((row) => {
            for (let j = 0; j < this.keys.length; j++) {
                string += row[this.keys[j]].padStart(lengths[j] + 2, ' ');
            }
            string += '\r\n';
        });
        console.log(string);
        return this;
    }

    _slice(start = 0, length) {
        length = length || (this.dataset.length - start);
        return this.dataset.slice(start, start + length);
    }


}


class Poll {

    //Dimensions et paramètres du tracé
    static size = {width: 1600, height: 800};
    static margins = {top: 50, right: 50, bottom: 100, left: 80};
    static params = {   minCurvePoints:10, curveMode:d3.curveBasis, bandWidth:.2, curveWidth:5,
                        areaWidth:1, areaOpacity:.4,
                        dotsOpacity:.1, dotsRadius:5,
                        duration:1000 };

    constructor() {
        //Creation du SVG, du calque principal et du clippath
        this.svg = d3.select('#conteneur_graphique')
            .append("svg:svg")
            .attr('id', 'motherOfPolls')
            .attr(`preserveAspectRatio`, 'xMaxYMin meet')
            .attr('viewBox', `0 0 ${Poll.size.width} ${Poll.size.height}`)
            .attr('width', `100%`);
        this.svg.append('defs')
            .html('<pattern id="pattern-stripe" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="4" transform="translate(0,0)" fill="white"></rect></pattern><mask id="mask-stripe"> <rect x="0" y="0" width="100%" height="100%" fill="url(#pattern-stripe)"/></mask>')
        this.container = this.svg
            .append('svg:g')
            .classed('mainLayer', true)
            .attr('transform', `translate(${Poll.margins.left} ${Poll.margins.top})`);
        //Objet data
        this.data = {
            resultats: undefined,
            candidats: undefined,
            sondages: undefined
        }
        this.view = new Proxy({
            dots: false,
            areas: false,
        }, {
            get: (target,property)=>{
                return target[property];
            },
            set: (target,property,value)=> {
               if (property==='dots') {
                   let o=(value)?Poll.params.dotsOpacity:0;
                   console.log(o);
                   d3.select('g#dots').call(this._fade,0,Poll.params.duration,o);
               }
               else if (property==='areas') {
                    let o=(value)?Poll.params.areaOpacity:0;
                    console.log(o);
                    d3.selectAll('g#curves path.area').call(this._fade,0,Poll.params.duration,o);
                }
               return true;
           }
        });
        //Recalcule la taille effective (une fois enlevées les marges)
        this.size = {
            font: Poll.size.width / 100,
            width: (Poll.size.width - Poll.margins.left - Poll.margins.right),
            height: (Poll.size.height - Poll.margins.top - Poll.margins.bottom)
        };

        //Scales
        this.xScale = d3.scaleTime().range([0, this.size.width]);
        this.yScale = d3.scaleLinear().range([this.size.height, 0]);
        //Axes
        this.size.calHeight=this.size.height/30;        //Hauteur de l'axe des mois et des années
        this.dateFn = d3.timeFormat('%d %b %Y');
        this.xAxisGenerator = d3.axisBottom(this.xScale).ticks(5).tickFormat(x => this.dateFn(x));
        this.xAxisGeneratorM = d3.axisBottom(this.xScale).ticks(d3.timeMonth).tickSize(20).tickFormat(d3.timeFormat("%B"));
        this.yAxisGenerator = d3.axisLeft(this.yScale).tickFormat(x => x + '%').tickSizeOuter(0);
        this.yGridGenerator = d3.axisLeft(this.yScale).tickFormat('').tickSize(-this.size.width).tickSizeOuter(0);
        //Création des calques
        this.layers = {};
        this._createLayer('xAxis','axis').attr('transform', `translate(0 ${this.size.height+this.size.calHeight})`);
        this._createLayer('mAxis','axis').attr('transform', `translate(0 ${this.size.height})`);
        this._createLayer('yAxis','axis');
        this._createLayer('yGrid','axis');
        this._createLayer('dots');
        this._createLayer('curves').attr('clip-path', 'url(#clipPath)')
             .append('clipPath')    //Clippath pour l'animation
                    .attr('id', 'clipPath')
                    .append("rect")
                        .attr('id', 'clipRect')
                        .attr('x',0)
                        .attr('y', Poll.margins.top)
                        .attr('width', 0)
                        .attr('height', this.size.height);

    }

    /**
     * Crée et renvoie un nouveau groupe svg:g dans le conteneur
     * @param id
     * @param className
     * @returns {*|On}
     * @private
     */
    _createLayer(id,className){
        return this.layers[id] = this.container.append('svg:g')
                                                .attr('id', id)
                                                .classed(className, className);
    }

    /**
     * Injecte les données dans la propriété this.data
     * @param property
     * @param dataWrapper
     * @returns {Poll}
     */
    push(property, data) {
        this.data[property] = data;
        return this;
    }

    /**
     * Calcule les domaines et les scales
     * @returns {Poll}
     * @private
     */
    _calcDomainAndScales() {
        //Calcule les domaines (et les élargit un peu) et les échelles
        this.xDomain = this.data.resultats.extent('debut');
        this.xDomain[0] = this.xDomain[0].setDate(this.xDomain[0].getDate() - 3);   //Trois jours avant
        this.xDomain[1] = new Date();   //Le lendemain
        this.xScale.domain(this.xDomain);

        this.yDomain = this.data.resultats.extent('borne_sup');
        this.yDomain = [0, (this.yDomain[1]+1)];
        this.yScale.domain(this.yDomain);
        this.yAxisGenerator.tickValues(d3.range(0,this.yDomain[1], 5));
        return this;
    }

    /**
     * Renvoie un array contenant les dates des sondages
     * @returns {Date[]}
     * @private
     */
    _getPollDates() {
        let uniqueDates = new Set([...this.data.sondages.values()].map(d => d.debut));
        return Array.from(uniqueDates)
            .filter(d => d)
            .map(d => new Date(d));
    }

    _zoom() {        //A developper
        this.xAxis2 = (g, x) => g
            .attr('transform', `translate(0 ${this.size.height})`)
            .call(this.xAxisGenerator);
        let zoomed = (event) => {
            const xz = event.transform.rescaleX(this.xScale);
            let zoomLevel = event.transform.k;
            //path.attr("d", area(data, xz));
            this.layers.xAxis.call(this.xAxis2, xz).selectAll('text')
                .style('font-size', this.size.font)
                .style('text-transform', 'capitalize')
                .attr('transform', 'rotate(50) translate(0 5)')
                .style('text-anchor', 'start')
                .text(this.dateFn);
        }
        const zoom = d3.zoom()
            .scaleExtent([1, 32])
            .extent([[this.margins.left, 0], [this.size.width - this.margins.right, this.size.height]])
            .translateExtent([[this.margins.left, -Infinity], [this.size.width - this.margins.right, Infinity]])
            .on('zoom', zoomed);

        this.svg.call(zoom)
            .transition()
            .duration(750)
            .call(zoom.scaleTo, 1, [this.xScale(Date.UTC(2021, 2, 1)), 0]);


    }

    /**
     * Renvoie une fonction de régression correspondant aux points définis par la clé (resultat, borne_inf ou borne_sup)
     * @param key
     * @returns {*} : function
     * @private
     */
    _loessRegression (key='resultat', bandwidth) {
        bandwidth=bandwidth || Poll.params.bandWidth;
        return d3.regressionLoess()
            .x(d => d.debut)
            .y(d => d[key])
            .bandwidth( bandwidth );
    }

    /**
     * Lance le tracé des courbes, de la marge d'erreur et des points
     */
    draw() {

        /* Test
        this.data.chiffres.filters.add( "test",(d)=> d.candidat==11 ); //teste selection canddiat 0 uniquement
        console.log(this.data.chiffres.col('intentions'));
         */

        //this.data.resultats.filters.add("recent", (d) => d.debut > new Date(2021, 7, 1));

        this._calcDomainAndScales()

        this._drawXAxis()
            ._drawMAxis()
            ._drawYAxis()
            ._drawDots()
            ._drawChart();
        //Animation initiale (effet de rollover pour les courbes, puis affichage graduel des marges)
        anime({
            targets: '#clipRect',
            easing: 'easeInOutExpo',
            width: 1600,
            delay: 10,
            duration: 2000,
            complete: ()=> {
                this.view.dots=true;
                this.view.areas=true;
            }
            });
        return this;

    }

    /**
     * Création de l'axe des abscisses
     * @returns {Poll}
     * @private
     */
    _drawXAxis() {
        this.xAxisGenerator
            .tickValues(this._getPollDates());
        this.layers.xAxis
            .call(this.xAxisGenerator)
            .selectAll('text')
            .style('font-size', this.size.font)
            .style('text-transform', 'capitalize')
            .attr('transform', 'translate(-10 5)')
            .style('text-anchor', 'start');
        return this;
    }

    /**
     * Création de l'axe secondaire des abscisses
     * @returns {Poll}
     * @private
     */
    _drawMAxis() {
        this.layers.mAxis
            .call(this.xAxisGeneratorM)
            .selectAll('text')
                .style('text-transform', 'uppercase')
                .style('text-anchor', 'middle')
                .style('font-size', this.size.calHeight/2)
                .style('font-weight', 'bold')
                .each( (date,i,nodes)=> {
                    //Décalage du label de la moitié de la distance jusqu'au prochain tick
                    let nextMonth=new Date(date.getTime());
                    nextMonth.setMonth(nextMonth.getMonth() + 1);
                    let offsetX=(this.xScale(nextMonth)-this.xScale(date))/2;
                    if (new Date()>nextMonth) {
                        d3.select(nodes[i]).attr('transform',`translate(${offsetX} -${this.size.calHeight*.75})`);
                    }
                    else {
                        d3.select(nodes[i]).remove();
                    }
                    //Colorie une case sur deux
                    if (i%2==0) {
                        d3.select(nodes[i].parentNode)
                            .append('rect')
                                .attr('x',0)
                                .attr('y',0)
                                .attr('width',offsetX*2)
                                .attr('height',this.size.calHeight)
                                .style('fill','rgba(10,10,10,.1)')
                    }
                });

/*        this.layers.mAxis.append('rect')
            .attr('x',0)
            .attr('y',0)
            .attr('width',this.size.width)
            .attr('height',this.size.calHeight)
            .style('fill','rgba(128,128,128,.1)');*/

        return this;
    }

    /**
     * Création de l'axe des ordonnées
     * @returns {Poll}
     * @private
     */
    _drawYAxis() {
        this.layers.yAxis
            .call(this.yAxisGenerator)
            .selectAll('text')
            .style('font-size', this.size.font*1.5)
            .style('text-anchor', 'end');
        this.layers.yAxis
            .call(this.yAxisGenerator)
            .selectAll('line')
            .style('stroke-width', 2);
        this.layers.yGrid
            .call(this.yGridGenerator)
            .selectAll('line')
            .style('stroke', '#ddd');
        return this;
    }

    /**
     * Création des points (estimations des sondages). Caché par défaut
     * @returns {Poll}
     * @private
     */
    _drawDots() {
        this.dots = this.layers.dots
            .selectAll('circle')
            .data(this.data.resultats.dataset)
            .enter()
            .append('circle')
                .attr('class',d => `id_${d.id_candidat}`)
                .attr("cx", d => this.xScale(d.debut))
                .attr("cy", d => this.yScale(d.resultat))
                .attr("r", 6)
                .style('display','none')
                .style('opacity', Poll.params.dotsOpacity)
                .style('pointer-events', 'none')
                .style('fill', (d) => this.data.candidats.get(d.id_candidat).couleur)
                .append('title')
                    .html(d => this.data.candidats.get(d.id_candidat).nom + ': ' + d.resultat + '%');
        return this;
    }

    /**
     * Création du graphique
     * @returns {Poll}
     * @private
     */
    _drawChart() {
        //Fonctions generatrices du path pour la courbe et la surface
        const curveGen = d3.line()
            .x(d => this.xScale(d[0]))
            .y(d => this.yScale(d[1]))
            .curve(Poll.params.curveMode);
        const areaGen = d3.area()
            .x(d=> this.xScale(d[0]))
            .y0(d=> this.yScale(d[1]))
            .y1( d=> this.yScale(d[2]))
            .curve(Poll.params.curveMode);
        //Boucle création des courbes pour chaque candidat
        for (let id of this.data.candidats.keys()) {
            let data = this.data.resultats.dataset
                .filter(d => d.id_candidat === id);
            if (data.length >= Poll.params.minCurvePoints) {      //Inutile de tracer une courbe si moins de x points
                //Creation calque id_X
                const layer=this.layers.curves.append('svg:g').classed(`id_${id}`,true);
                //Tracé de la courbe
                this._drawCurve(id,data,curveGen,layer);
                //Tracé de la marge d'erreur
                let loessData=[ this._loessRegression('borne_inf')(data),
                                this._loessRegression('borne_sup')(data)],
                    combinedData=[];
                for (let i=0;i<loessData[0].length;i++)
                    combinedData.push([loessData[0][i][0],loessData[0][i][1],loessData[1][i][1]]);
                this._drawArea(id,combinedData,areaGen,layer);
            }
        }
        return this;
    }

    /**
     * Création de la courbe d'un candidat
     * @param id {Number} : identifiant du candidat
     * @param data {Object} : données des sondages correspondant au candidat
     * @param generator {Function} : fonction pour le tracé de la courbe (curveGen, définie dans la méthode _drawChart)
     * @param container {Object} : selection D3 de l'élement parent (g)
     * @private
     */
    _drawCurve(id,data,generator,container){
        container.append("path")
            .classed('courbe', true)
            .classed(`id_${id}`, true)
            .datum( this._loessRegression('resultat')(data))
            .attr("d", generator)
            .style('stroke', this.color(id))
            .style('stroke-linecap', 'round')
            .style('stroke-linejoin', 'round')
            .style('stroke-width', Poll.params.curveWidth)
            .style('fill', 'transparent')
            .append('title')
            .html( `${this.data.candidats.get(id).nom} (${this.data.candidats.get(id).sigle})`);

    }

    /**
     * Création de la marge d'erreur d'un candidat
     * @param id {Number} : identifiant du candidat
     * @param data {Object} : données des sondages correspondant au candidat
     * @param generator {Function} : fonction pour le tracé de la surface (areaGen, définie dans la méthode _drawChart)
     * @param container {Object} : selection D3 de l'élement parent (g)
     * @private
     */
    _drawArea(id,data,generator,container) {
                container.datum(data)
                    .append('path')
                        .classed('area',true)
                        .classed(`id_${id}`, true)
                        .attr('d', generator(data))
                        .attr('fill', this.color(id, Poll.params.areaOpacity))
                        .attr('mask', 'url(#mask-stripe)')
                        .attr('stroke', this.color(id,(Poll.params.areaOpacity-.1)))
                        .attr('stroke-width',Poll.params.areaWidth)
                        .style('opacity', 0)
                        .style('stroke-linecap', 'round')
                        .style('stroke-linejoin', 'round');
                 //       .call(this._fade,1000,2000,Poll.params.areaOpacity);
      }


    /**
     * Fonction appelée pour ajouter un effet d'animation
     * @param selection
     * @param delay
     * @param duration
     * @param targetOpacity
     * @returns {Poll}
     * @private
     */
    _fade(selection, delay=0, duration=1000, opacity=1){
        anime({
            targets: selection.nodes(),
            easing: 'easeInOutCubic',
            delay:delay,
            duration:duration,
            opacity: opacity,
            complete: ()=>{
                let pointerEvents=(opacity)?'auto':'none';
                selection.style('pointer-events',pointerEvents);
            }
        });
        return this;
    }



    /**
     * Renvoie la couleur du candidat, ou une couleur de contraste (noir sur fond clair, blanc sur fond sombre) si contrast=true
     * @param id_candidat
     * @param opacity : Number
     * @param contrast : Boolean
     * @returns {string}
     */
    color (id_candidat, opacity=1, contrast=false){
        let c=this.data.candidats.get(id_candidat).couleur || '#fff';
        c=d3.color(c);
        if (contrast) c= (d3.hsl(color).l>.5) ? '#000':'#fff';
        if (opacity<1) c.opacity=opacity;
        return c.toString();
    }

    update() {

    }

}



class Candidat extends Queue{

    static duration=500;
    static delay=0;
    static queue=new Queue();

    constructor(id,data){
        super();
        this.id=id;
        this.data=data;
    }

    hide(){
        Candidat.hide(this.id);
        return this;
    }
    show(){
        Candidat.show(this.id);
        return this;
    }
    highlight(){
        Candidat.highlight(this.id);
        return this;
    }

    static hide(listeCandidats,duration,delay){
        console.warn('HIDE');
        Candidat.queue.enqueue( Candidat._animate('hide',listeCandidats,duration));
        return Candidat;
    }

    static show(listeCandidats,duration,delay){
        console.warn('SHOW');
        Candidat.queue.enqueue( Candidat._animate('show',listeCandidats,duration));
        return Candidat;
    }

    static _animate(type='show', listeCandidats, duration,delay){
        console.warn(type);
        let nodes=new Array();
        if (duration===undefined) duration=Candidat.duration;
        if (delay===undefined)  delay=Candidat.delay;
        if (listeCandidats=='all') listeCandidats=d3.range(0,40,1);
        if (!Array.isArray(listeCandidats)) listeCandidats=[listeCandidats];
        listeCandidats.forEach( id => {  nodes=nodes.concat( Candidat._getNodes(id));});
        return new Promise((resolve,reject) => {
                switch (type){
                    case 'show':
                        d3.selectAll(nodes)
                            .style('opacity',0)
                            .style('display','block')
                            .transition()
                            .duration(duration)
                            .delay(delay)
                            .style('opacity',(d,i,n)=> (n[i].tagName=='circle')?.1:1 )
                            .on('start', ()=> { console.log('Begin show',duration, listeCandidats)})
                            .on('end', ()=> { console.log('shwed'); resolve('Show');});
                        break;
                    case 'hide':
                        d3.selectAll(nodes)
                            .transition()
                            .duration(duration)
                            .style('opacity',0)
                            .on('start', ()=> { console.log('Begin hide',duration, listeCandidats)})
                            .on('end', ()=> { d3.selectAll(nodes).style('display','none'); resolve('Hide'); } );
                        break;
                    case 'highlight':
                        break;
                }
            });


    }

    static _getNodes(id){
        return d3.select('#motherOfPolls')
            .selectAll('g#chart,g#dots')
            .selectAll(`.id_${id}`)
            .nodes();
    }


}