Object.assign(d3, d3regression);

class Queue {
    static queue = [];
    static pendingPromise = false;

    static enqueue(promise) {
        return new Promise((resolve, reject) => {
            this.queue.push({
                promise,
                resolve,
                reject,
            });
            this.dequeue();
        });
    }

    static dequeue() {
        if (this.workingOnPromise) {
            return false;
        }
        const item = this.queue.shift();
        if (!item) {
            return false;
        }
        try {
            this.workingOnPromise = true;
            item.promise()
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
    static params = {
        minCurvePoints: 10, curveMode: d3.curveBasis, bandWidth: .2, curveWidth: 5,
        areaWidth: 1, areaOpacity: .4,
        dotsOpacity: .1, dotsRadius: 5,
        duration: 1000
    };

    constructor() {
        //Creation du SVG, du calque principal et du clippath
        this.svg = d3.select('#conteneur_graphique')
            .append("svg:svg")
            .attr('id', 'motherOfPolls')
            .attr(`preserveAspectRatio`, 'xMaxYMin meet')
            .attr('viewBox', `0 0 ${Poll.size.width} ${Poll.size.height}`)
            .attr('width', `100%`);
        this.svg.append('defs')
            .html("<pattern id='pattern-stripe' width='8' height='8' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'><rect width='4' height='8' transform='translate(0,0)' fill='white'></rect></pattern><mask id='mask-stripe'> <rect x='0' y='0' width='100%' height='100%' fill='url(#pattern-stripe)'/></mask>");
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
        //Objet permettant d'afficher ou masquer certaines parties du graphique. Usage : Poll.toggle.dots(true|false)
        this.toggle={
            states: {
                dots:false,
                areas:true,
            },
            dots:(bool)=>{
                if (bool===undefined) return this.toggle.states.dots;

                let o = (bool) ? Poll.params.dotsOpacity : 0;
                console.log(bool,o);
                d3.selectAll('g#dots circle')
                    .call(this._fade, 0, Poll.params.duration, o);
                this.toggle.states.dots=bool;
            },
            areas:(bool)=>{
                if (bool===undefined) return this.toggle.states.areas;

                let o = (bool) ? Poll.params.areaOpacity : 0;
                d3.selectAll('g#curves path.area')
                    .call(this._fade, 0, Poll.params.duration, o);
                this.toggle.states.areas=bool;
            }
        }
        //Recalcule la taille effective (une fois enlevées les marges)
        this.size = {
            font: Poll.size.width / 100,
            width: (Poll.size.width - Poll.margins.left - Poll.margins.right),
            height: (Poll.size.height - Poll.margins.top - Poll.margins.bottom),
            ribbonHeight: (Poll.size.height - Poll.margins.top - Poll.margins.bottom) / 40
        };
        this.size.ribbonHeight = this.size.height / 20;        //Hauteur de l'axe des mois et des années
        //Handler pour le zoom & pan (rectangle transparent sur toute la surface)
        //Handlers
        this.zoomHandler = this.container
            .append('rect')
                .attr('id', 'zoomHandler')
                .attr('y', (this.size.height-this.size.ribbonHeight*4))
                .attr('width', this.size.width)
                .attr('height', this.size.ribbonHeight*6)
                .style('opacity', 0)
                .style('pointer-events', 'all');
        //Scales
        this.xScale = d3.scaleTime().range([0, this.size.width]);
        this.yScale = d3.scaleLinear().range([this.size.height, 0]);
        //Axes

        this.dateFn = d3.timeFormat('%d %b %Y');
        this.xAxisGenerator = d3.axisBottom(this.xScale).ticks(5).tickSize(10).tickSizeOuter(0).tickFormat(x => this.dateFn(x));
        this.xMonthsGenerator = d3.axisBottom(this.xScale).ticks(d3.timeMonth).tickSize(this.size.ribbonHeight).tickFormat(d3.timeFormat("%b"));
        this.xYearsGenerator = d3.axisBottom(this.xScale).ticks(d3.timeYear).tickSize(-this.size.height).tickFormat(d3.timeFormat("%Y")).tickSizeOuter(0);
        this.yAxisGenerator = d3.axisLeft(this.yScale).tickFormat(x => x + '%').tickSizeOuter(0);
        this.yGridGenerator = d3.axisLeft(this.yScale).tickFormat('').tickSize(-this.size.width * .99).tickSizeOuter(0);
        //Création des calques
        this.layers = {};
        this._createLayer('xAxis', 'axis').attr('transform', `translate(0 ${this.size.height + this.size.ribbonHeight})`);
        this._createLayer('xMonths', 'axis').attr('transform', `translate(0 ${this.size.height})`);
        this._createLayer('xYears', 'axis').attr('transform', `translate(0 ${this.size.height})`);
        this._createLayer('yAxis', 'axis');
        this._createLayer('yGrid', 'axis');
        this._createLayer('dots');
        this._createLayer('curves');


    }

    /**
     * Crée et renvoie un nouveau groupe svg:g dans le conteneur
     * @param id
     * @param className
     * @returns {*|On}
     * @private
     */
    _createLayer(id, className) {
        return this.layers[id] = this.container.append('svg:g')
            .attr('id', id)
            .classed(className, className);
    }

    /**
     * Renvoie la sélection d3, sinon crée l'élement et le renvoie
     * USAGE: this._superSelect(d3Parent,'rect') , this._superSelect (d3Parent,'#myId'),
     * @param parent {} Selection D3
     * @param tag
     * @param id
     * @param className
     * @returns {*|Fn|Zi}
     * @private
     */
    _superSelect(parent,tag='g',id,className){
        let selector=(tag)?`${tag}`:'';
        if (id) selector+=`#${id}`;
        if (className) selector+=`.${className}`;
        let selection=parent.selectAll(selector);
        if (selection.empty())  {
            selection = parent.append(tag).classed(className,className);
            if (id) selection.attr('id',id);
        }
        return selection;
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
        this.xDomain[0] = this.xDomain[0].setDate(this.xDomain[0].getDate() - 2);   //Deux jours avant
        this.xDomain[1] = new Date();   //Le lendemain
        this.xScale.domain(this.xDomain);

        this.xAxisGenerator.tickValues(this._getPollDates());

        this.yDomain = this.data.resultats.extent('borne_sup');
        this.yDomain = [0, (this.yDomain[1] + 1)];
        this.yScale.domain(this.yDomain);
        this.yAxisGenerator.tickValues(d3.range(0, this.yDomain[1], 5));

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


    _zoomTo() {        //A developper
        let zoomed = (event) => {
            let transform = event.transform;
                            transform.x = 0;
                            transform.y = this.size.height + this.size.ribbonHeight;
            if (transform.k>2) this.xMonthsGenerator.tickFormat(d3.timeFormat("%B"));
            else this.xMonthsGenerator.tickFormat(d3.timeFormat("%b"))

            let newScale = transform.rescaleX(this.xScale);
            // this.xAxisGenerator.scale(newScale);

            this._drawXAxis(newScale)
            this._drawXMonths(newScale);
            this._drawXYears(newScale);
        //    this._drawChart(newScale);
            //   this.layers.xMonths                .call(this.xMonthsGenerator);


            /*  let xAxis=this.layers.xAxis
                              .attr('transform',transform.toString());
      /*        xAxis.selectAll('text')
                  .style('font-size', this.size.font)
                  .style('text-transform', 'capitalize')
                  .attr('transform', 'translate(-10 5)')
                  .style('text-anchor', 'start');
              this.xAxisGenerator.tickSize(5/event.transform.k);*/
        }
        let zoom = d3.zoom()
            .scaleExtent([1, 6])
             .extent([Poll.margins.left, Poll.margins.top], [this.size.width, this.size.height])
            .on('zoom', zoomed);
        this.zoomHandler.call(zoom);


        /*
       // this.xAxis2 = (g, x) => g.call(this.xAxisGenerator);
        let zoomed = (event) => {
            const xz = event.transform.rescaleX(this.xScale);
            let zoomLevel = event.transform.k;
            //path.attr("d", area(data, xz));
            this.layers.xAxis.call(this.xAxisGenerator, xz);
        }
        const zoom = d3.zoom()
            .scaleExtent([1, 32])
            .extent([[Poll.margins.left, 0], [this.size.width, this.size.height]])
            .translateExtent([[Poll.margins.left, -Infinity], [this.size.width, Infinity]])
            .on('zoom', zoomed);

        this.svg.call(zoom)
            .transition()
            .duration(2000)
            .call(zoom.scaleTo, 1, [this.xScale(Date.UTC(2021, 2, 1)), 0]);
*/

    }

    /**
     * Renvoie une fonction de régression correspondant aux points définis par la clé (resultat, borne_inf ou borne_sup)
     * @param key
     * @returns {*} : function
     * @private
     */
    _loessRegression(key = 'resultat', bandwidth) {
        bandwidth = bandwidth || Poll.params.bandWidth;
        return d3.regressionLoess()
            .x(d => d.debut)
            .y(d => d[key])
            .bandwidth(bandwidth);
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
            ._drawXMonths()
            ._drawXYears()
            ._drawYAxis()
            ._drawDots()
            ._drawChart();
        //Animation initiale (effet de rollover pour les courbes, puis affichage graduel des marges)
        this.layers.curves.attr('clip-path', 'url(#mainClipPath)');
        this.layers.dots.attr('clip-path', 'url(#mainClipPath)');
        this.container.append('clipPath')    //Clippath pour l'animation
            .attr('id', 'mainClipPath')
            .append("rect")
                .attr('id', 'mainClip')
                .attr('x', 0)
                .attr('y', 0)
                .attr('width', 0)
                .attr('height', this.size.height);
        anime({
            targets: '#mainClip',
            easing: 'easeInOutExpo',
            width: this.size.width,
            delay: 10,
            duration: 2000,
            complete: () => this.toggle.areas(true)
        });

        setTimeout(() => {
            this._zoomTo();
            /*
            this.xDomain=[new Date('2021-01-01'),new Date('2021-11-01')];
            this.xScale.domain(this.xDomain);
            this._drawXAxis();*/
        }, 1000)
        return this;

    }

    /**
     * Création de l'axe des abscisses
     * @param xScale
     * @returns {Poll}
     * @private
     */
    _drawXAxis(xScale) {
        xScale= xScale || this.xScale;
        this.xAxisGenerator.scale(xScale);
        const xAxis = this.layers.xAxis
            .call(this.xAxisGenerator);
        xAxis.selectAll('text')
                .style('font-size', this.size.font)
                .style('text-transform', 'capitalize')
                .attr('transform', 'translate(-10 5)')
                .style('text-anchor', 'start');
        xAxis.selectAll('line,path')
            .attr('vector-effect', 'non-scaling-stroke');
        return this;
    }

    /**
     * Création de l'axe secondaire (mois) des abscisses
     * @param xScale
     * @returns {Poll}
     * @private
     */
    _drawXMonths(xScale) {
        xScale = xScale || this.xScale;
        let axis = this.layers.xMonths
            .call(this.xMonthsGenerator.scale(xScale))
        //.call(monthsGenerator)
        axis.selectAll('text')
            .style('text-transform', 'uppercase')
            .style('text-anchor', 'middle')
            .style('font-size', this.size.ribbonHeight / 1.7)
            .style('font-weight', 'bold')
            .each((date, i, nodes) => {     //Centrage des étiquettes
                if (date){ //A supprimer qd problème année réglée
             //       console.log(date, i, nodes);
                    //Décalage du label de la moitié de la distance jusqu'au prochain tick
                    let nextMonth = new Date(date.getTime());
                    nextMonth.setMonth(nextMonth.getMonth() + 1);
                    let x = xScale(date),
                        offsetX = (xScale(nextMonth) - x) / 2;
                    if (new Date() > nextMonth) {
                        d3.select(nodes[i]).attr('transform', `translate(${offsetX} -${this.size.ribbonHeight * .75})`);
                    } else {
                        d3.select(nodes[i]).remove();
                    }
                    //Colorie une case sur deux
                    if (i % 2 == 0) {
                        this._superSelect(d3.select(nodes[i].parentNode),'rect')
                            .attr('x', 0)
                            .attr('y', 0)
                            .attr('width', offsetX * 2)
                            .attr('height', this.size.ribbonHeight)
                            .style('fill', 'rgba(10,10,10,.1)');

                    }
                }
            });

        /*        this.layers.xMonths.append('rect')
                    .attr('x',0)
                    .attr('y',0)
                    .attr('width',this.size.width)
                    .attr('height',this.size.ribbonHeight)
                    .style('fill','rgba(128,128,128,.1)');*/

        return this;
    }

    /**
     * Création de l'axe secondaire (année) des abscisses
     * @param xScale
     * @returns {Poll}
     * @private
     */
    _drawXYears(xScale) {
        xScale = xScale || this.xScale;
        let axis = this.layers.xYears
            .call(this.xYearsGenerator.scale(xScale))
        //.call(monthsGenerator)
        axis.selectAll('text')
            .attr('dy',-this.size.ribbonHeight*.8)
            .attr('dx',this.size.width/100)
            .style('text-transform', 'uppercase')
            .style('text-anchor', 'start')
            .style('font-size', this.size.ribbonHeight *2)
            .style('font-weight', 'bold')
            .style('font-weight', 'bolder')
            .style('fill', '#ddd');
        axis.selectAll('line')
            .style('stroke','#ddd');


        //Ajoute l'année
      /*  if (date.getMonth() == 0) {
            this.layers.xMonths.append('text')
                .text(date.getFullYear())
                .attr('x', x + this.size.ribbonlHeight / 2)
                .attr('dy', -(this.size.ribbonHeight / 2))
                .style('text-anchor', 'start')
                .style('font-size', this.size.ribbonHeight * 3)

            /*      this.layers.xMonths.append('line')
                      .attr('x1', x)
                      .attr('x2', x)
                      .attr('y1', 0)
                      .attr('y2', -(this.size.height))
                      .style('stroke', '#eee');*/

        return this;
    }



    /**
     * Création de l'axe des ordonnées
     * @returns {Poll}
     * @private
     */
    _drawYAxis() {
        //Axe Y
        this.layers.yAxis
            .call(this.yAxisGenerator)
            .selectAll('text')
            .style('font-size', this.size.font * 1.5)
            .style('text-anchor', 'end');
        this.layers.yAxis
            .call(this.yAxisGenerator)
            .selectAll('line')
            .style('stroke-width', 2);
        //Grid
        this.layers.yGrid
            .attr('transform', `translate(${this.size.width / 200} 0)`)
            .call(this.yGridGenerator)
            .selectAll('line')
            .style('stroke', '#ddd');
        this.layers.yGrid
            .selectAll('path')
            .style('display', 'none')
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
            .attr('class', d => `id_${d.id_candidat}`)
            .attr("cx", d => this.xScale(d.debut))
            .attr("cy", d => this.yScale(d.resultat))
            .attr("r", 6)
            .style('opacity', 0)
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
    _drawChart(xScale) {
        xScale=xScale||this.xScale;
        //Fonctions generatrices du path pour la courbe et la surface
        const curveGen = d3.line()
            .x(d => xScale(d[0]))
            .y(d => this.yScale(d[1]))
            .curve(Poll.params.curveMode);
        const areaGen = d3.area()
            .x(d => xScale(d[0]))
            .y0(d => this.yScale(d[1]))
            .y1(d => this.yScale(d[2]))
            .curve(Poll.params.curveMode);
        //Boucle création des courbes pour chaque candidat
        for (let id of this.data.candidats.keys()) {
            let data = this.data.resultats.dataset
                .filter(d => d.id_candidat === id);
            if (data.length >= Poll.params.minCurvePoints) {      //Inutile de tracer une courbe si moins de x points
                //Creation calque id_X
                const layer = this.layers.curves.append('svg:g').classed(`id_${id}`, true)
                    .style('display', () => this.data.candidats.get(id).defaut ? 'auto' : 'none')
                    .style('opacity', () => this.data.candidats.get(id).defaut ? 1 : 0);
                //Tracé de la courbe
                this._drawCurve(id, data, curveGen, layer);
                //Tracé de la marge d'erreur
                let loessData = [this._loessRegression('borne_inf')(data),
                        this._loessRegression('borne_sup')(data)],
                    combinedData = [];
                for (let i = 0; i < loessData[0].length; i++)
                    combinedData.push([loessData[0][i][0], loessData[0][i][1], loessData[1][i][1]]);
                this._drawArea(id, combinedData, areaGen, layer);
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
    _drawCurve(id, data, generator, container) {
        container.append("path")
            .classed('courbe', true)
            .classed(`id_${id}`, true)
            .datum(this._loessRegression('resultat')(data))
            .attr("d", generator)
            .style('stroke', this.color(id))
            .style('stroke-linecap', 'round')
            .style('stroke-linejoin', 'round')
            .style('stroke-width', Poll.params.curveWidth)
            .style('fill', 'transparent')
            .append('title')
            .html(`${this.data.candidats.get(id).nom} (${this.data.candidats.get(id).sigle})`);

    }

    /**
     * Création de la marge d'erreur d'un candidat
     * @param id {Number} : identifiant du candidat
     * @param data {Object} : données des sondages correspondant au candidat
     * @param generator {Function} : fonction pour le tracé de la surface (areaGen, définie dans la méthode _drawChart)
     * @param container {Object} : selection D3 de l'élement parent (g)
     * @private
     */
    _drawArea(id, data, generator, container) {
        container.datum(data)
            .append('path')
            .classed('area', true)
            .classed(`id_${id}`, true)
            .attr('d', generator(data))
            .attr('fill', this.color(id, Poll.params.areaOpacity))
            .attr('mask', 'url(#mask-stripe)')
            .attr('stroke', this.color(id, (Poll.params.areaOpacity - .1)))
            .attr('stroke-width', Poll.params.areaWidth)
            .style('opacity', 0)
            .style('stroke-linecap', 'round')
            .style('stroke-linejoin', 'round');

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
    _fade(selection, delay = 0, duration = 1000, opacity = 1) {
        selection.style('display','auto');
        anime({
            targets: selection.nodes(),
            easing: 'easeInOutCubic',
            delay: delay,
            duration: duration,
            opacity: opacity,
            complete: () => {
                let pointerEvents = (opacity) ? 'auto' : 'none';
                selection.style('pointer-events', pointerEvents);
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
    color(id_candidat, opacity = 1, contrast = false) {
        let c = this.data.candidats.get(id_candidat).couleur || '#fff';
        c = d3.color(c);
        if (contrast) c = (d3.hsl(color).l > .5) ? '#000' : '#fff';
        if (opacity < 1) c.opacity = opacity;
        return c.toString();
    }

    update() {

    }

}


class Candidat extends Queue {

    static duration = 500;
    static delay = 0;

    constructor(id, data) {
        super();
        this.id = id;
        this.data = data;
    }

    static hide(listeCandidats, duration, delay) {
        Queue.enqueue(Candidat._animate('hide', listeCandidats, duration));
        return Candidat;
    }

    static show(listeCandidats, duration, delay) {
        Queue.enqueue(Candidat._animate('show', listeCandidats, duration));
        return Candidat;
    }

    static _animate(type = 'show', listeCandidats, duration, delay) {
        let nodes = new Array();
        if (duration === undefined) duration = Candidat.duration;
        if (delay === undefined) delay = Candidat.delay;
        if (listeCandidats == 'all') listeCandidats = d3.range(0, 40, 1);
        if (!Array.isArray(listeCandidats)) listeCandidats = [listeCandidats];
        listeCandidats.forEach(id => {
            nodes = nodes.concat(Candidat._getNodes(id));
        });
        return () => new Promise((resolve, reject) => {
            switch (type) {
                case 'show':
                    d3.selectAll(nodes)
                        .style('opacity', 0)
                        .style('display', 'block')
                        .transition()
                        .duration(duration)
                        .delay(delay)
                        .style('opacity', (d, i, n) => (n[i].tagName == 'circle') ? Poll.params.dotsOpacity : 1)
                        .on('end', () => {
                            resolve('Affichage courbe');
                        });
                    break;
                case 'hide':
                    d3.selectAll(nodes)
                        .transition()
                        .duration(duration)
                        .style('opacity', 0)
                        .on('end', () => {
                            d3.selectAll(nodes).style('display', 'none');
                            resolve('Masquage courbe');
                        });
                    break;
                case 'highlight':
                    break;
            }
        });


    }

    static _getNodes(id) {
        return d3.select('#motherOfPolls')
            .selectAll('g#curves,g#dots')
            .selectAll(`.id_${id}`)
            .nodes();
    }

    hide() {
        Candidat.hide(this.id);
        return this;
    }

    show() {
        Candidat.show(this.id);
        return this;
    }

    highlight() {
        Candidat.highlight(this.id);
        return this;
    }


}