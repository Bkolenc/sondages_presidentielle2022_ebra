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
                if (property == 'dataset') {
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

    static size = {width: 1600, height: 800};
    static margins = {top: 50, right: 50, bottom: 100, left: 80};
    static params = { minPoints:10, curveMode:d3.curveBasis, bandWidth:.25, curveWidth:5, areaWidth:1, areaOpacity:.2, dotsOpacity:.1 };

    constructor() {
        //Dimensions et paramètres du tracé

        //Creation du SVG, du calque principal et du clippath
        this.svg = d3.select('#conteneur_graphique')
            .append("svg:svg")
            .attr('id', 'motherOfPolls')
            .attr(`preserveAspectRatio`, 'xMaxYMin meet')
            .attr('viewBox', `0 0 ${Poll.size.width} ${Poll.size.height}`)
            .attr('width', `100%`);
        this.svg.append('clipPath')
            .attr('id', 'clipPoll')
            .append("rect")
            .attr('x', Poll.margins.left)
            .attr('y', Poll.margins.top)
            .attr("width", Poll.size.width/2)
            .attr("height", Poll.size.height)
            .style("fill", "none")
            .style("pointer-events", "all");
        this.svg.append('defs')
            .html('<pattern id="pattern-stripe" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="4" transform="translate(0,0)" fill="white"></rect></pattern><mask id="mask-stripe"> <rect x="0" y="0" width="100%" height="100%" fill="url(#pattern-stripe)"/></mask>')
        this.container = this.svg
            .append('svg:g')
            .classed('mainLayer', true)
            .attr('transform', `translate(${Poll.margins.left} ${Poll.margins.top})`);
        //Objet data
        this.data = {
            candidats: undefined
        };
        //Détermine la taille effective (une fois enlevées les marges)
        this.size = {
            font: Poll.size.width / 100,
            width: (Poll.size.width - Poll.margins.left - Poll.margins.right),
            height: (Poll.size.height - Poll.margins.top - Poll.margins.bottom)
        };
        //Scales
        this.xScale = d3.scaleTime()
            .range([0, this.size.width]);
        this.yScale = d3.scaleLinear()
            .range([this.size.height, 0]);
        //Axes
        this.dateFn = d3.timeFormat('%d %b %Y');
        this.xAxisGenerator = d3.axisBottom(this.xScale).ticks(5).tickFormat(x => this.dateFn(x));
        this.yAxisGenerator = d3.axisLeft(this.yScale).tickValues(d3.range(0, 61, 10)).tickFormat(x => x + '%').tickSizeOuter(0);
        //Création des calques
        this.layers = {};
        this.layers.xAxis = this.container.append('svg:g')
            .attr('id', 'xAxis')
            .classed('axis', true)
            .attr('transform', `translate(0 ${this.size.height})`);
        this.layers.yAxis = this.container.append('svg:g')
            .attr('id', 'yAxis')
            .classed('axis', true);
        this.layers.dots = this.container.append('svg:g')
            .attr('id', 'dots');
        this.layers.charts = this.container.append('svg:g')
            .attr('id', 'chart');

    }

    /**
     * Injecte les données dans la propriété this.data
     * @param property
     * @param dataWrapper
     * @returns {Poll}
     */
    push(property, dataWrapper) {
        this.data[property] = dataWrapper;
        return this;
    }

    candidats(){
        return{
            list: new Set(),
            show: (list)=>{
                if (list.isInteger()) list=[list];
                this.candidats=list;
                return this.candidats;
            },
            hide: (list)=>{

            },
            highlight:(list)=>{

            }
        }
    }

    /**
     * Calcule les domaines et les scales
     * @returns {Poll}
     * @private
     */
    _calcDomainAndScales() {
        //Calcule les domaines (et les élargit un peu) et les échelles
        this.xDomain = this.data.resultats.extent('debut');
        this.xDomain[0] = this.xDomain[0].setDate(this.xDomain[0].getDate() - 1);   //La veille
        this.xDomain[1] = this.xDomain[1].setDate(this.xDomain[1].getDate() + 1);   //Le lendemain
        this.xScale.domain(this.xDomain);

        this.yDomain = this.data.resultats.extent('resultat');
        this.yDomain = [0, (this.yDomain[1] + 5)];
        this.yDomain = [0, 30];
        this.yScale.domain(this.yDomain);
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
    _loessRegression (key='resultat') {
        return d3.regressionLoess()
            .x(d => d.debut)
            .y(d => d[key])
            .bandwidth(Poll.params.bandWidth);
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
            ._drawYAxis()
            ._drawDots()
            ._drawChart();
        return this;

    }

    /**
     * Création de l'axe des abscisses
     * @returns {Poll}
     * @private
     */
    _drawXAxis() {

        this.xAxisGenerator.tickValues(this._getPollDates());
        this.layers.xAxis
            .call(this.xAxisGenerator)
            .selectAll('text')
            .style('font-size', this.size.font)
            .style('text-transform', 'capitalize')
            .attr('transform', 'rotate(50) translate(0 5)')
            .style('text-anchor', 'start');
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
        return this;
    }

    /**
     * Création des points (estimations des sondages)
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
                .style('opacity', Poll.params.dotsOpacity)
                .style('fill', (d) => this.data.candidats.get(d.id_candidat).couleur)
                .call(this._fadeIn,1000,2000,Poll.params.dotsOpacity)
                .append('title')
                    .html(d => this.data.candidats.get(d.id_candidat).nom_candidat + ': ' + d.resultat + '%');
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
        //Boucle candidats
        for (let id of this.data.candidats.keys()) {
            let data = this.data.resultats.dataset
                .filter(d => d.id_candidat === id);
            if (data.length >= Poll.params.minPoints) {      //Inutile de tracer une courbe si moins de x points
                //Creation calque candX
                const layer=this.layers.charts.append('svg:g').classed(`c${id}`,true);
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
                        .style('stroke-linecap', 'round')
                        .style('stroke-linejoin', 'round')
                        .call(this._fadeIn,1000,2000);
      }

    /**
     * Fonction appelée pour ajouter un effet d'animation
     * @param selection
     * @param delay
     * @param duration
     * @param opacity
     * @private
     */
    _fadeIn(selection,delay=0,duration=1000,opacity=1){
        selection
            .style('opacity',0)
            .transition()
                .delay(delay)
                .duration(duration)
                .style('opacity',opacity);
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

class Candidat {

    static duration=1000;

    constructor(id,data){
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

    static hide(listeCandidats,duration){
        return Candidat._toggle('hide',listeCandidats,duration);
    }

    static show(listeCandidats,duration){
        return Candidat._toggle('show',listeCandidats,duration);
    }

    static _toggle(type='show',listeCandidats,duration){
        if (duration===undefined) duration=Candidat.duration;
        if (listeCandidats=='all') listeCandidats=d3.range(0,40,1);
        if (!Array.isArray(listeCandidats)) listeCandidats=[listeCandidats];
        listeCandidats.forEach( id => {
            switch (type){
                case 'show':    Candidat._getItems(id)
                                            .style('opacity',0)
                                            .style('display','block')
                                            .transition()
                                            .duration(duration)
                                            .style('opacity',1);
                                break;
                case 'hide':    Candidat._getItems(id)
                                            .transition()
                                            .duration(duration)
                                            .style('opacity',0)
                                            .on('end', function(e) { d3.select(this).style('display','none'); } );
                                 break;
                case 'highlight': break;
            }
        });
        return Candidat;
    }

    static _getItems(id){
        return d3.select('#motherOfPolls')
            .selectAll('g#chart,g#dots')
            .selectAll(`.id_${id}`);
    }


}