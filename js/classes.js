import {G_sondages} from './globales.js';

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
        this.dataset = undefined;
        this.index = 0;         //Index pour l'itérateur
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

    filter(fn) {
        if (!this.dataset) throw('Aucune donnée à filtrer');
        else {
            return new DataWrapper(this.id + '_f').push(this.dataset.filter(fn));
        }
    }

    /**
     * Initialise l'instance avec un dataset
     * @param dataset : Array
     * @returns {DataWrapper}
     */
    push(dataset) {
        if (!Array.isArray(dataset) && dataset.constructor === Object) dataset = this._convertFromDict(dataset);
        this.dataset = dataset;
        this.keys = (dataset.length) ? Object.keys(dataset[0]) : [];
        return this;
    }

    /**
     * Convertit un dictionnaire en array (en injectant la clé dans une colonne id)
     * @param dict
     * @returns {unknown[]}
     * @private
     */
    _convertFromDict(dict, keyName = 'id') {
        return Object.entries(dict).map((d) => {
            d[1][keyName] = d[0];
            return d[1];
        });
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

    toGroups(keys) {
        if (typeof keys === 'string') keys = [keys];
        let fns = keys.map((k) => (d) => d[k]),
            nested = d3.groups(this.dataset, ...fns);      //A vérifier que ça marche avec plusieurs clés...
        return nested;
    }

    map(fn) {
        this.dataset = this.dataset.map(fn);
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
        if (typeof key == 'string') {
            return d3.extent(this.col(key));
        } else if (Array.isArray(key)) {
            return [this.min(key[0]), this.max(key[1])];
        }
    }

    /**
     * Renvoie la valeur minimale d'une colonne
     * @param key {String} : clé
     * @returns {*} : Number
     */
    min(key) {
        return d3.min(this.col(key));
    }

    /**
     * Renvoie la valeur maximale d'une colonne
     * @param key {String} : clé
     * @returns {*} : Number
     */
    max(key) {
        return d3.max(this.col(key));
    }

    sortBy(key) {
        this.dataset = this.dataset.sort((a, b) => d3.ascending(a[key], b[key]));
        return this;
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

class DomElement {

    /**
     * Constructeur
     * @param id
     */
    constructor(id) {
        this.id = id || DomElement.uuidv4();
    }

    /**
     * Générateur d'identifiants uniques
     * @returns {string}
     */
    static uuidv4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            let r = Math.random() * 16 | 0,
                v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    appendTo(parent, container = this.container) {
        try {
            this.parent = (typeof parent == 'string') ? d3.select(`#${parent}`) :
                (parent.constructor.name == 'Item') ? parent.container :
                    parent;
            this.parent.append(() => container.node());
        } catch (error) {
            console.warn(error);
        } finally {
            return this;
        }
    }

    getParent(tag = "div") {
        return d3.select(this.container.node().closest(tag));
    }

    static _getMatrix(selection) {
        return selection.node().getCTM();
        var matrix = selection.node().viewportElement.createSVGMatrix(),
            localTransformList = selection.node().transform.baseVal;
        if (localTransformList.length) {
            matrix = localTransformList.consolidate().matrix;
        }
        return matrix;
    }

    static _setMatrix(selection, matrix) {
        selection.attr('transform', `matrix(${matrix.a} ${matrix.b} ${matrix.c} ${matrix.d} ${matrix.e} ${matrix.f})`);
    }

    delete() {
        return this.container.remove();
    }

    empty() {
        this.container.selectAll('*').remove();
        return this;
    }

    hide(options) {
        const _options = {delay: 0, duration: 100},
            o = {..._options, ...options};
        this.container
            .transition()
            .delay(o.delay)
            .duration(o.duration)
            .style('opacity', 0)
            .on('end', () => this.container.style('display', 'none'));
        return this;
    }

    show(options) {
        const _options = {delay: 0, duration: 100},
            p = {..._options, ...options};
        this.container
            .transition()
            .delay(o.delay)
            .duration(o.duration)
            .style('opacity', 1)
            .on('start', () => this.container.style('display', 'auto').style('opacity', 0));
        return this;
    }

}

class MetaPoll extends DomElement {

    //Dimensions et paramètres du tracé
    static size = {width: 1600, height: 1000};
    static margins = {top: 50, right: 50, bottom: 150, left: 160};
    static params = {
        areaWidth: 1, areaOpacity: .3,
        pointsOpacity: .1, pointsRadius: 3,
        axis: {width: 2},
        curve: {minPts: 10, mode: d3.curveBasis, bandwidth: .2, width: 3},
        duration: 500
    };

    constructor(id) {
        super(id);
        //Calcule les tailles effectives des principaux élements
        this.size = {
            width: (MetaPoll.size.width - MetaPoll.margins.left - MetaPoll.margins.right),
            height: (MetaPoll.size.height - MetaPoll.margins.top - MetaPoll.margins.bottom),
            mainContainer: {
                width: (MetaPoll.size.width - MetaPoll.margins.left - MetaPoll.margins.right),
                height: (MetaPoll.size.height - MetaPoll.margins.top - MetaPoll.margins.bottom) * .75,
                rHeight: (MetaPoll.size.height - MetaPoll.margins.top - MetaPoll.margins.bottom) / 40
            },
            brushContainer: {
                width: (MetaPoll.size.width - MetaPoll.margins.left - MetaPoll.margins.right),
                height: (MetaPoll.size.height - MetaPoll.margins.top - MetaPoll.margins.bottom) * .15
            },
            thumbs: {
                radius: parseInt((MetaPoll.size.height - MetaPoll.margins.top - MetaPoll.margins.bottom) / 12)
            },
            font: {
                small: d3.min([MetaPoll.size.height / 40, 20]),
                normal: d3.min([MetaPoll.size.height / 20, 40]),
                large: d3.min([MetaPoll.size.height / 10, 80])
            }
        };
        //Creation du SVG, du calque principal et du pattern
        this.svg = d3.create('svg:svg')
            .attr('id', 'SuperPoll')
            .attr(`preserveAspectRatio`, 'xMaxYMin meet')
            .attr('viewBox', `0 0 ${MetaPoll.size.width} ${MetaPoll.size.height}`)
            .attr('width', `100%`);
        this.svg.append('defs')
            .html("<pattern id='pattern-stripe' width='8' height='8' patternUnits='userSpaceOnUse' patternTransform='rotate(45)'><rect width='4' height='8' transform='translate(0,0)' fill='white'></rect></pattern><mask id='mask-stripe'> <rect x='0' y='0' width='100%' height='100%' fill='url(#pattern-stripe)'/></mask>");
        this.mainContainer = this.svg
            .append('svg:g')
            .classed('mainLayer', true)
            .attr('transform', `translate(${MetaPoll.margins.left} ${MetaPoll.margins.top})`);
        this.brushContainer = this.svg
            .append('svg:g')
            .classed('brushLayer', true)
            .attr('transform', `translate(${MetaPoll.margins.left} ${MetaPoll.size.height - this.size.brushContainer.height - this.size.font.small * 3})`);
        this.figuresContainer = this.svg
            .append('svg:g')
            .classed('figuresLayer', true)
            .attr('transform', `translate(${MetaPoll.margins.left} ${MetaPoll.margins.top})`);
        //Propriété data
        this.data = {
            resultats: undefined,
            candidats: undefined,
            sondages: undefined
        }
        this.drawableSelection = [];
        //Objet permettant d'afficher ou masquer certaines parties du graphique. Usage : MetaPoll.toggle.points(true|false)
        this.toggle = {
            states: {
                points: false,
                areas: true,
            },
            points: (bool) => {
                if (bool === undefined) return this.toggle.states.points;
                let o = (bool) ? MetaPoll.params.pointsOpacity : 0;
                G_sondages.selection_candidats
                    .forEach((id) =>
                        d3.selectAll('g#points ellipse.' + id)
                            .call(this._fade, 0, MetaPoll.params.duration, o)
                    )
                this.toggle.states.points = bool;
            },
            areas: (bool) => {
                if (bool === undefined) return this.toggle.states.areas;
                let o = (bool) ? MetaPoll.params.areaOpacity : 0;
                d3.selectAll('g#curves path.area')
                    .call(this._fade, 0, MetaPoll.params.duration / 2, o);
                this.toggle.states.areas = bool;
            }
        }

        //Handlers
        this.focusHandler = this._createHandler('focusHandler', 0, 0, this.size.mainContainer.width, this.size.mainContainer.height);

        //Scales
        this.xScale = d3.scaleTime().range([0, this.size.mainContainer.width]);
        this.yScale = d3.scaleLinear().range([this.size.mainContainer.height, 0]);

        //Zoom
        this._zoom = d3.zoom()
            .translateExtent([[0, 0], [this.size.mainContainer.width, this.size.mainContainer.height]])
            .on('zoom', this._handleZoom.bind(this));

        //Générateurs des axes du graphique principal
        this.xAxisGenerator = d3.axisBottom(this.xScale).tickSize(0).tickSizeOuter(0).tickFormat('');  //d3.timeFormat("%d")
        this.yAxisGenerator = d3.axisLeft(this.yScale).tickFormat(x => x + '%').tickSizeOuter(0);
        this.yGridGenerator = d3.axisLeft(this.yScale).tickFormat('').tickSize(-this.size.mainContainer.width * .99).tickSizeOuter(0);

    }

    appendTo(parent) {
        DomElement.prototype.appendTo.call(this, parent, this.svg);
        this._createStructure();
        return this;
    }

    _createStructure() {
        //CLippaths
        this._createClipPath('clipChart', 0, 0, 0, (this.size.mainContainer.height + MetaPoll.margins.bottom));
        this._createClipPath('clipXAxis', -this.size.font.small * 1.8, -MetaPoll.size.height, this.size.mainContainer.width + this.size.font.small * 3.6, MetaPoll.size.height + 150);
        //Slider
        this.slider = this.mainContainer
            .append('line')
            .attr('id', 'slider')
            .attr('x1', 0)
            .attr('y1', this.size.font.large * .8)
            .attr('x2', 0)
            .attr('y2', this.size.mainContainer.height)
            .style('stroke', 'rgba(128,128,128,.5)')
            .style('stroke-width', '6px')
            .lower();
        //Création des calques
        this.layers = {};
        this._createLayer('points');//.attr('clip-path', 'url(#clipChart)');
        this._createLayer('curves');//.attr('clip-path', 'url(#clipChart)');
        this.mainContainer.append('text')
            .attr('id', 'dateHelper')
            .attr('x', this.size.mainContainer.width)
            .attr('y', `${this.size.font.large / 2}px`)
            .attr('text-anchor', 'end')
            .style('font-size', `${this.size.font.large}px`)
            .style('font-weight', '900');

        const xAxis = this._createLayer('xAxis', 'axis')
            .attr('transform', `translate(0 ${this.size.mainContainer.height})`)
            .attr('clip-path', 'url(#clipXAxis)');
        this._createLayer('xDays', 'axis', xAxis);

        const cache = this._createLayer('cache', 'cache');     //Hack degueu mais le clipping ne suit pas assez vite les modifs de la courbe
        cache.append('rect')
            .attr('x', -MetaPoll.margins.left)
            .attr('y', 0)
            .attr('width', MetaPoll.margins.left)
            .attr('height', this.size.mainContainer.height);
        cache.append('rect')
            .attr('x', this.size.mainContainer.width)
            .attr('y', 0)
            .attr('width', MetaPoll.margins.right)
            .attr('height', this.size.mainContainer.height);

        const yAxis = this._createLayer('yAxis', 'axis');
        this._createLayer('yPrct', 'axis', yAxis);
        this._createLayer('yGrid', 'axis', yAxis);


        //Selecteur HTML
        /*   this.selector=this.parent
               .append('nav')
               .attr('id','options');
           this._createSelector('Masquer les marges d\'erreur','area_chart')
               .on('click',(e,n)=> {
                   let state=this.toggle.areas(),
                       text=(state)?'Afficher':'Masquer';
                   d3.filter(e.target).filter('span.text').text(`${text} les marges d'erreur`);
                   this.toggle.areas(!state);
               });
           this._createSelector('Afficher le détail des estimations','insights')
               .on('click',(e,n)=> {
                   let state=this.toggle.points(),
                       text=(state)?'Afficher':'Masquer';
                   d3.filter(e.target).filter('span.text').text(`${text}  le détail des estimations`);
                   this.toggle.points(!state);
               });*/
        return this;
    }

    /**
     * Crée et renvoie un nouveau groupe svg:g dans l'élement parent (this.mainContainer par défaut)
     * @param id
     * @param className
     * @param parent
     * @returns {*|On}
     * @private
     */
    _createLayer(id, className, parent) {
        parent = parent || this.mainContainer;
        return this.layers[id] = parent.append('svg:g')
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
    _superSelect(parent, tag = 'g', id, className) {
        let selector = (tag) ? `${tag}` : '';
        if (id) selector += `#${id}`;
        if (className) selector += `.${className}`;
        let selection = parent.selectAll(selector);
        if (selection.empty()) {
            selection = parent.append(tag).classed(className, className);
            if (id) selection.attr('id', id);
        }
        return selection;
    }

    /**
     * Crée et renvoie un bouton sous la forme icone+texte
     * @param text
     * @param icon
     * @param parent
     * @returns {*}
     * @private
     */
    _createSelector(text, icon, parent) {
        parent = parent || d3.select('nav#options');
        let selector = parent.append('p')
        selector.append('span')
            .classed('material-icons', true)
            .html(icon);
        selector.append('span')
            .classed('text', true)
            .text(text);
        return selector;
    }

    /**
     * Crée dans le calque principal, et renvoie, un handler rectangulaire pour la gestion des interactions
     * @param id {String} : identifiant
     * @param x {Number}: origine x du rectangle
     * @param y {Number}: origine y du rectangle
     * @param width {Number} : largeur du rectangle
     * @param height {Number} : hauteur du rectangle
     * @returns {*} : selection D3
     * @private
     */
    _createHandler(id, x, y, width, height) {
        const rect = this._createRect(x, y, width, height);
        return this.mainContainer
            .append(rect)
            .attr('id', id)
            .classed('handler', true)
            .raise();
    }

    /**
     * Crée dans le defs un clippath rectangulaire et le renvoie
     * @param id {String} : identifiant
     * @param x {Number}: origine x du rectangle
     * @param y {Number}: origine y du rectangle
     * @param width {Number} : largeur du rectangle
     * @param height {Number} : hauteur du rectangle
     * @returns {*} : selection D3
     * @private
     */
    _createClipPath(id, x, y, width, height) {
        const rect = this._createRect(x, y, width, height);
        return this.svg.select('defs')
            .append('clipPath')
            .attr('id', id)
            .append(rect);
    }

    /**
     * Renvoie une fonction générant un rectangle SVG (méthode commune à _createHandler et _createClippath)
     * @param x {Number}: origine x du rectangle
     * @param y {Number}: origine y du rectangle
     * @param width {Number} : largeur du rectangle
     * @param height {Number} : hauteur du rectangle
     * @returns {Function} : arrow function
     * @private
     */
    _createRect(x, y, width, height, className) {
        const rect = d3.create('svg:rect')
            .attr('x', x)
            .attr('y', y)
            .attr('width', width)
            .attr('height', height)
            .classed(className, className);
        return () => rect.node();
    }

    /**
     * Injecte les données dans la propriété this.data
     * @param property
     * @param dataWrapper
     * @returns {MetaPoll}
     */
    push(property, data) {
        this.data[property] = data;
        if (this.data.resultats && this.data.candidats) this.pollset = new PollController(this.data.resultats, this.data.candidats);
        return this;
    }

    /**
     * Calcule les domaines et les scales
     * @returns {MetaPoll}
     * @private
     */
    _domainAndScales() {
        //Axe X
        this.xDomain = this.data.resultats.extent('debut');
        this.xScale.domain(this.xDomain);
        this.xAxisGenerator.tickValues(this._pollDates());
        //Axe Y
        this.yDomain = this.data.resultats.extent('borne_sup');
        this.yDomain = [0, this.yDomain[1]];
        this.yScale.domain(this.yDomain);
        this.yAxisGenerator.tickValues(d3.range(0, this.yDomain[1], 5));
        this.yGridGenerator.tickValues(d3.range(5, this.yDomain[1], 5));
        return this;
    }


    /**
     * Renvoie un array contenant les dates des sondages
     * @returns {Date[]}
     * @private
     */
    _pollDates() {
        let myDates = [];
        this.data.sondages.forEach((v) => myDates.push(v.debut));
        myDates = new Set([...myDates]);
        this.dates = Array.from(myDates)
            .map(d => new Date(d))
            .sort(d3.ascending);
        return this.dates;
    }


    /**
     * Méthode appelée par this._zoom pour appliquer les transformations sur chaque partie du graphique
     * @param e {Object} : objet passé par la méthode this._zoom
     * @private
     */
    _handleZoom(e) {
        //Déplacement et zoom sur les courbes, modification inverse du clippath et du pattern
        let [x, k, ki] = [e.transform.x, e.transform.k, 1 / e.transform.k];
        if (isFinite(x) && isFinite(k)) {
            d3.select('#curves').transition().duration(MetaPoll.params.duration).attr('transform', `translate(${x} 0) scale(${k} 1)`);
            //   d3.filter('#pattern-stripe').transition().duration(MetaPoll.params.duration).attr('patternTransform',`rotate(45) scale(${ki} 1)`);
            //       d3.filter('#clipChart rect').attr('transform',`translate(${-x/k} 0) scale(${ki} 1)`);   Remplacé par système de cache
            // d3.filter('#points').transition().duration(MetaPoll.params.duration).attr('transform',`translate(${x} 0) scale(${k} 1)`);
            // d3.selectAll('#points ellipse').transition().duration(MetaPoll.params.duration).attr('transform',`scale(${ki} 1)`)

            //Déplacement et zoom des axes
            this.transform = e.transform;
            this._drawXAxis(e.transform);
        }
    }


    /**
     * Zoome sur une plage de dates
     * @param range {Array} : dates de debut et de fin
     * @private
     */
    _zoomToRange(range) {
        let xScale = this.xScale,
            [begin, end] = range;
        begin = Math.max(begin, this.xDomain[0]);
        end = Math.min(end, this.xDomain[1]);
        this.svg.call(this._zoom.transform,
            d3.zoomIdentity.scale(this.size.mainContainer.width / (xScale(end) - xScale(begin))).translate(-xScale(begin), 0)
        );
        //Masque le slider et les vignettes, reinitialise les ticks X
        Thumb.hideAll();
        this.slider.style('opacity', 0);
        this._dateHelper('')._resetXTicks();
        return this;
    }

    /**
     * Réinitialise les styles des ticks X (cachés par défaut). Méthode appelée avant un zoom
     * @returns {MetaPoll}
     * @private
     */
    _resetXTicks() {
        this.layers.xAxis.selectAll('line').attr('stroke-width', '1px').attr('stroke', '#333');
        // this.layers.xAxis.selectAll('text,tspan,rect').style('opacity', 0);
        return this;
    }

    /**
     * Renvoie une fonction de régression correspondant aux points définis par la clé (resultat, borne_inf ou borne_sup)
     * @param key {String} : clé des données à utiliser (resultat,borne_inf ou borne_sup)
     * @param bandwidth {Float} : facteur de lissage
     * @returns {*} : function
     * @private
     */
    _loessRegression(key = 'resultat', bandwidth) {
        bandwidth = bandwidth || MetaPoll.params.curve.bandwidth;
        return d3.regressionLoess()
            .x(d => d.debut)
            .y(d => d[key])
            .bandwidth(bandwidth);
    }

    /**
     * Tracé initial des courbes et des marges d'erreur
     * @returns {MetaPoll}
     */
    draw() {
        this._firstDraw = true;
        this._domainAndScales()
            ._drawYAxis()
            ._drawXAxis()
            //._drawPoints()
            ._drawMainChart()
            ._drawBrushChart()
            ._enableFocus();


        //Animation initiale (effet de rollover pour les courbes, puis affichage graduel des marges)
        /*      anime({
                  targets: '#clipChart rect',
                  easing: 'easeInOutExpo',
                  width: this.size.mainContainer.width,
                  delay: 100,
                  duration: MetaPoll.params.duration * 3,
                  begin: () => {
                      //let range=getUrlDomain();
                      //this._zoomTo(range.begin,range.end);
                      //   this._enableFocus();
                  },
                  complete: () => {
                      this._firstDraw = false;
                      //  let range=getUrlDomain();
                      //    this._zoomTo(range.begin,range.end);
                      this.toggle.areas(true);
                      // this._enableFreeZoom();

                      /*   setTimeout(()=>{
                                let begin=new Date(2021,9,1);
                                let end=new Date(2021,11,12);
                                this._zoomTo(begin,end);
                            },4000);

                            setTimeout(()=>{
                                let begin=new Date(2020,6,18);
                                let end=new Date(2021,11,12);
                                this._zoomTo(begin,end);
                            },8000);

                  }
              });*/
        return this;

    }

    _dateHelper(date = undefined, highlight = false) {
        d3.select('#dateHelper')
            .text((date) ? d3.timeFormat('%e %B %Y')(date) : '')
            .classed('highlight', highlight);
        return this;
    }

    /**
     * Affichage des tendances
     * @private
     */
    _enableFocus() {

        //Création des vignettes
        const thumbs = new Map();
        this.drawableSelection
            .forEach(id => {
                thumbs.set(id, new Thumb(id, this.data.candidats.get(id), this.size.thumbs.radius, this.size.font.large).appendTo(this.figuresContainer));
            });
        //Renvoie l'ordonnée Y de la courbe en fonction de l'abscisse X (y compris pour données interpolées)
        const getYFromX = (id, x) => {
            const path = this.mainContainer.select(`path.id_${id}`).node(),
                pathLength = path.getTotalLength(),
                pathBeginning = path.getPointAtLength(0).x,
                pathEnd = path.getPointAtLength(pathLength).x;
            if (x < pathBeginning) return false; //Renvoie faux en début de graphique si le candidat n'a pas encore été sondé
            let start = 0,
                end = pathLength,
                target = (start + end) / 2;
            x = Math.max(x, pathBeginning);
            x = Math.min(x, pathEnd);
            //Parcourt et réduit la courbe pour trouver la position (par rapport à la longueur) correspondant à X, puis renvoie Y
            while (target >= start && target <= pathLength) {
                let pos = path.getPointAtLength(target);
                if (Math.abs(pos.x - x) < 0.001) {
                    return pos.y;
                } else if (pos.x > x) {
                    end = target;
                } else {
                    start = target;
                }
                target = (start + end) / 2
            }

        }
        //Recalcule et modifie la position du slider et des vignettes
        const updateSlider = (x0, transition = false) => {
            if (x0 < this.size.thumbs.radius / 2 || x0 > this.size.mainContainer.width) {
                return false;
            } else {
                x0 = Math.max(this.size.thumbs.radius / 2 + 5, x0);
                x0 = Math.min(x0, this.size.mainContainer.width - 5);
                let x = (x0 - this.transform.x) / this.transform.k;
                this._dateHelper(this.xScale.invert(x));
                //     console.log(G_sondages.selection_candidats,Array.from(this.data.candidats.keys()));
                for (let id of this.drawableSelection) {
                    let y = getYFromX(id, x);
                    if (y !== false) {
                        thumbs.get(id)
                            .setValue(this.yScale.invert(y))
                            .orientation((x0 < this.size.mainContainer.width / 2) ? 'right' : 'left')
                            .move(x0, y);
                    } else {  //Cache l'élément si candidat pas encore sondé
                        thumbs.get(id).hide();
                    }
                }

                /*
                G_sondages.selection_candidats
                    .map(d => parseInt(d.replace('id_', '')))
                    .forEach(id => {
                        let y = getYFromX(id, x);
                        if (y !== false){
                            thumbs.get(id)
                                .setValue(this.yScale.invert(y))
                                .orientation( (x0<this.size.mainContainer.width/2)? 'right':'left')
                                .move(x0, y);
                        }
                        else {
                            thumbs.get(id).hide();
                        }
                    });*/

                if (!transition) this.slider.attr('x1', x0).attr('x2', x0);
                else this.slider.transition().duration(100).attr('x1', x0).attr('x2', x0);
                return true;
            }

        }
        const thresholdX = (x) => {
            return (x < this.size.font) ? this.size.font :
                (x > this.size.mainContainer.width - this.size.font) ? this.size.mainContainer.width - this.size.font :
                    x;
        }
        //Renvoie la date de sondage la plus proche de l'abscisse
        const findClosest = (x0) => {
            let x = (x0 - this.transform.x) / this.transform.k;
            const date = this.xScale.invert(x),
                neighbors = [];
            for (let i = 0; i < this.dates.length; i++) {
                if (this.dates[i] <= date) {
                    neighbors[0] = this.dates[i];
                } else if (this.dates[i] >= date) {
                    neighbors[1] = this.dates[i];
                    break;
                }
            }
            return ((neighbors[1] - date) < (date - neighbors[0])) ? neighbors.reverse() : neighbors;

        }

        const selectTick = (date) => {
            this.layers.xAxis.selectAll('g.tick')
                .each(function (d) {
                    if (d == date) {
                        d3.select(this).raise().classed('active', true);
                    }
                });
        }


        d3.select('#focusHandler')
            .raise()
            .call(d3.drag()
                .on("start", () => {
                    this.slider.style('opacity', .5);
                    this.layers.xAxis.selectAll('g.tick.active').classed('active', false);
                    this.drawableSelection
                        .filter(id => G_sondages.selection_candidats.includes(`id_${id}`))
                        .forEach(id => thumbs.get(id).show())
                    d3.select('#focusHandler').style('cursor', 'ew-resize');
                })
                .on("drag", (e) => {
                    let x = thresholdX(e.x);
                    updateSlider(x);
                })
                .on('end', (e) => {
                    this.slider.style('opacity', 0.2);
                    d3.select('#focusHandler').style('cursor', 'default');
                    let x = thresholdX(e.x),
                        closestDate = findClosest(x)[0];
                    if (updateSlider(this.transform.rescaleX(this.xScale)(closestDate), true)) {
                        selectTick(closestDate);
                        this._dateHelper(closestDate, true);
                        new PollController().filterByDate(closestDate).draw();
                        console.warn('AFFICHAGE SONDAGE', closestDate, new PollController());
                    }
                })
            );

        return this;
    }


    /**
     * Affiche une collection de sondages correspondant à la date dans l'instance PollController
     * @param date
     * @private
     */
    _showPoll(date) {

    }

    /**
     * Création de l'axe des abscisses (graphique principal)
     * @param transform {Object} : objet transform pour pan & zoom
     * @returns {MetaPoll}
     * @private
     */
    _drawXAxis(transform) {
        //Recalcul éventuel de l'échelle
        const xScale = (transform) ? transform.rescaleX(this.xScale) : this.xScale;
        //Appel du générateur
        const xAxis = this.layers.xDays
            .call(this.xAxisGenerator.scale(xScale))
            .call(g => g.selectAll('text')
                .attr('transform', `translate(0 ${this.size.font.normal / 2})`)
                .text('\uf682')
                .style('font-size', `${this.size.font.normal}px`)
            );

        //Customisation 'mode calendrier'
        /*
        let dates = this.layers.xDays
            .selectAll('text')
            .attr('transform', 'translate(0 20)')
            .style('font-weight', 'bolder')
            .style('font-size', `${this.size.font.normal * 1.2}px`)
            .attr('fill', '#D00');
        dates.append('tspan')
            .attr('x', 0)
            .attr('dy', this.size.font.normal * .7)
            .attr('fill', 'black')
            .style('font-size', `${this.size.font.normal * .7}px`)
            .style('text-transform', 'uppercase')
            .text(d => d3.timeFormat('%b')(d).replace('.', ''));
        dates.append('tspan')
            .attr('x', 0)
            .attr('dy', this.size.font.small)
            .attr('fill', 'black')
            .style('font-size', `${this.size.font.normal * .55}px`)
            .text(d => d.getFullYear());
        let ticks = this.layers.xDays.selectAll('g.tick');
        ticks.attr('class', d => 'tick D' + d.toISOString().substring(0, 10))
            .append('rect')
            .attr('x', -this.size.font.normal * 1.25)
            .attr('y', 15)
            .attr('width', this.size.font.normal * 2.5)
            .attr('height', this.size.font.normal * 3)
            .attr('rx', 5)
            .attr('ry', 5)
            .attr('fill', '#f5f5f5')
            .attr('stroke', '#bbb')
            .attr('stroke-width', '.5px')
            .lower()
            .on('click', (e, date) => {
                console.log(date);
                this.pollset.filter(date);
            });
*/

        //Définition des styles de base lors du premier appel de la méthode
        if (this._firstDraw) {
            xAxis.selectAll('path')
                .style('stroke-width', `${MetaPoll.params.axis.width + 1}px`);
        }
        return this;
    }

    /**
     * Création de l'axe des ordonnées
     * @returns {MetaPoll}
     * @private
     */
    _drawYAxis() {
        //Axe Y
        this.layers.yPrct
            .call(this.yAxisGenerator)
            .call(g => g.selectAll('text').style('font-size', `${this.size.font.normal}px`));
        //Définition des styles et ajout d'un axe custom lors du premier appel de la fonction uniquement
        if (this._firstDraw) {
            this.layers.yPrct
                .call(this.yAxisGenerator)
                .selectAll('line,path')
                .style('stroke-width', MetaPoll.params.axis.width);
            this.layers.yGrid
                .call(this.yGridGenerator)
                .call(g => g.selectAll('path').remove());
        }
        return this;
    }

    /**
     * Création des points
     * @param xScale {Function} : échelle X
     * @returns {MetaPoll}
     * @private
     */
    _drawPoints(xScale) {
        xScale = xScale || this.xScale;
        let data = this.data.resultats.toGroups('sondage');
        this.layers.points
            .selectAll('g')
            .data(data)
            .enter()
            .append('g')
            .attr('id', (d) => `s_${d[0]}`)
            .attr('transform', (d) => 'translate(' + xScale(d[1][0]['debut']) + ' 0)')
            .selectAll('ellipse')
            .data(function (d) {
                return d[1]
            })
            .enter()
            .append('ellipse')
            .attr('class', d => `id_${d.id_candidat} h_${d.id_hypothèse}`)
            .attr('cx', 0)
            .attr('cy', d => this.yScale(d.resultat))
            .attr('rx', MetaPoll.params.pointsRadius)
            .attr('ry', MetaPoll.params.pointsRadius)
            .style('fill', (d) => this.data.candidats.get(d.id_candidat).couleur)
            .style('opacity', 0)
            .style('pointer-events', 'none');
        //  .html(d => this.data.candidats.get(d.id_candidat).nom + ': ' + d.resultat + '%');

        return this;
    }

    /**
     * Création du graphique
     * @returns {MetaPoll}
     * @private
     */
    _drawMainChart() {
        const xScale = this.xScale; //ENCORE UTILE???
        //Fonctions generatrices du path pour la courbe et la surface
        const curveGen = d3.line()
            .x(d => xScale(d[0]))
            .y(d => this.yScale(d[1]))
            .curve(MetaPoll.params.curve.mode);
        const areaGen = d3.area()
            .x(d => xScale(d[0]))
            .y0(d => this.yScale(d[1]))
            .y1(d => this.yScale(d[2]))
            .curve(MetaPoll.params.curve.mode);
        //Boucle création des courbes pour chaque candidat
        for (let id of this.data.candidats.keys()) {
            let data = this.data.resultats.dataset.filter(d => d.id_candidat === id);
            if (data.length >= MetaPoll.params.curve.minPts) {      //Inutile de tracer une courbe si moins de x points
                this.drawableSelection.push(id);
                //Creation calque id_X
                const layer = this.layers.curves
                    .append('svg:g')
                    .classed(`id_${id}`, true)
                    .style('display', () => (inArray("id_" + id, G_sondages.selection_candidats)) ? 'auto' : 'none')
                    .style('opacity', () => (inArray("id_" + id, G_sondages.selection_candidats)) ? 1 : 0);

                //Tracé de la courbe
                this._drawCurve(id, data, curveGen, layer);
                //Tracé de la marge d'erreur
                let loessData = [this._loessRegression('borne_inf')(data), this._loessRegression('borne_sup')(data)],
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
     * @param generator {Function} : fonction pour le tracé de la courbe (curveGen, définie dans la méthode _drawMainChart)
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
            .style('stroke-width', `${MetaPoll.params.curve.width}px`)
            .style('display', () => G_sondages.selection_candidats.includes(`id_${id}`) ? 'auto' : 'none');
    }

    /**
     * Crée la courbe secondaire (non zoomée, pour navigation)
     * @private
     */
    _drawBrushChart() {
        const xScale = this.xScale,
            yScale = this.yScale.copy().range([this.size.brushContainer.height, 0]),
            xGeneratorM = d3.axisBottom(xScale).ticks(d3.timeMonth).tickSize(-this.size.brushContainer.height).tickFormat((d) => d3.timeFormat("%b")(d).replace('.', '')).tickSizeOuter(0),
            xGeneratorY = d3.axisBottom(xScale).ticks(d3.timeYear).tickSize(0).tickSizeOuter(0),
            yGenerator = d3.axisLeft(yScale).tickSize(0).tickSizeOuter(0).tickFormat('').tickValues([]),
            fontSize = this.size.font.small,
            height = fontSize * 2,
            curveGen = d3.line()
                .x(d => xScale(d[0]))
                .y(d => yScale(d[1]))
                .curve(MetaPoll.params.curve.mode),
            background = this.brushContainer.append('g').classed('bck', true);


        //Tracé des courbes
        for (let id of this.data.candidats.keys()) {
            let data = this.data.resultats.dataset.filter(d => d.id_candidat === id);
            if (data.length >= MetaPoll.params.curve.minPts) {
                this._drawCurve(id, data, curveGen, this.brushContainer);
            }
        }
        //Création de l'axe X (mois)
        const getXTransformM = (date) => {
            const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1),
                offsetX = (xScale(nextMonth) - xScale(date)) / 2;
            return (this.xScale.domain()[1] < nextMonth) ? 'translate(0 -10000)' : `translate(${offsetX} ${fontSize / 2})`;
        }
        const createBackgroundM = (date) => {
            const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1),
                x = xScale(date);
            let width = xScale(nextMonth) - xScale(date);
            if ((x + width) > this.size.width) width = this.size.width - x;
            return this._createRect(xScale(date), this.size.brushContainer.height, width, fontSize * 1.8, (date.getMonth() % 2 == 0) ? 'odd' : 'even');
        }
        this._createLayer('brushYAxis', 'axis', this.brushContainer)
            .call(yGenerator.scale(yScale));
        this._createLayer('brushXAxis', 'axis', this.brushContainer)
            .attr('transform', `translate(0 ${this.size.brushContainer.height})`)
            .call(xGeneratorM.scale(xScale))
            .call(g => g.selectAll('text')
                .style('font-size', `${this.size.font.small}px`)
                .attr('transform', getXTransformM)
                .each(function (d, i, n) {
                    background.append(createBackgroundM(d));
                    if (d.getMonth() == 0) d3.select(this).append('tspan').attr('x', 0).attr('y', `${fontSize * 2.2}px`).text(d.getFullYear());
                }));

        //Creation brush
        new XBrushArea(this.brushContainer, this.xScale, this.yScale, this.size.brushContainer)
            .on('change', this._zoomToRange, this);
        return this;
    }

    /**
     * Création de la marge d'erreur d'un candidat
     * @param id {Number} : identifiant du candidat
     * @param data {Object} : données des sondages correspondant au candidat
     * @param generator {Function} : fonction pour le tracé de la surface (areaGen, définie dans la méthode _drawMainChart)
     * @param container {Object} : selection D3 de l'élement parent (g)
     * @private
     */
    _drawArea(id, data, generator, container) {
        container.datum(data)
            .append('path')
            .classed('area', true)
            .classed(`id_${id}`, true)
            .attr('d', generator(data))
            .attr('fill', this.color(id, MetaPoll.params.areaOpacity))
            //  .attr('mask', 'url(#mask-stripe)')
            .attr('stroke', this.color(id, (MetaPoll.params.areaOpacity - .1)))
            .attr('stroke-width', 0)
            .style('opacity', 0);

    }


    /**
     * Fonction appelée pour ajouter un effet d'animation
     * @param selection
     * @param delay
     * @param duration
     * @param targetOpacity
     * @returns {MetaPoll}
     * @private
     */
    _fade(selection, delay = 0, duration = 1000, opacity = 1) {
        selection.style('display', 'auto');
     /*   anime({
            targets: selection.nodes(),
            easing: 'easeInOutCubic',
            delay: delay,
            duration: duration,
            opacity: opacity,
            complete: () => {
                let pointerEvents = (opacity) ? 'auto' : 'none';
                selection.style('pointer-events', pointerEvents);
            }
        });*/
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
        console.log('HIDE');
        Queue.enqueue(Candidat._update('hide', listeCandidats, duration));
        return Candidat;
    }

    static show(listeCandidats, duration, delay) {
        console.log('SHOW');
        Queue.enqueue(Candidat._update('show', listeCandidats, duration));
        return Candidat;
    }

    static _update(type = 'show', listeCandidats, duration, delay) {
        console.log(G_sondages.selection_candidats);
        new PollController().draw();
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
                        .style('opacity', (d, i, n) => {
                            return (n[i].classList.contains("area")) ? MetaPoll.params.areaOpacity : 1;
                            //return (n[i].tagName == 'ellipse') ? MetaPoll.params.pointsOpacity : 1
                        })
                        .on('end', () => {
                            resolve('Showed!');
                        });
                    //  console.log(pollSet);
                    break;
                case 'hide':
                    d3.selectAll(nodes)
                        .transition()
                        .duration(duration)
                        .style('opacity', 0)
                        .on('end', () => {
                            d3.selectAll(nodes).style('display', 'none');
                            resolve('Hidden!');
                        });
                    break;
                case 'highlight':
                    break;
            }
        });


    }

    static _getNodes(id) {
        return d3.select('#SuperPoll')
            .selectAll('g#curves,g.brushLayer,g.figuresLayer')
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

class XBrushArea {

    constructor(container, xScale, yScale, size) {
        this.dispatch = d3.dispatch("change");
        this.container = container;
        this.x = xScale;
        this.y = yScale.copy().range([size.height, 0]);
        this.size = size;
        this.defaultSelection = [new Date(this.x.domain()[1].setDate(this.x.domain()[1].getDate() - 30)), this.x.domain()[1]];
        this.defaultXSelection = this.defaultSelection.map(this.x);
        this.brush = d3.brushX()
            .extent([[0.1, 0.1], [size.width, size.height]])
            .on('start', () => container.classed('active', true))
            .on('brush', this.brushed.bind(this))
            .on('end', () => {
                container.classed('active', false);
                this.brushended.bind(this);
            });
    }

    on(action, callback, context) {
        this.callback = callback;
        this.context = context;
        this.container.call(this.brush)
            .call(this.brush.move, this.defaultXSelection);
        return this;
    }

    brushed({selection}) {

        if (selection) {
            let [begin, end] = selection.map(d => this.x.invert(d)).map(d3.utcDay.round);
            //console.warn([begin,end]);
            this.callback.call(this.context, [begin, end]);

            //   svg.property("value", selection.map(x.invert, x).map(d3.utcDay.round));
            //   svg.dispatch("input");
        }
    }

    brushended({selection}) {
        if (!selection) {
            this.container
                .transition()
                .delay(100)
                .duration(500)
                .call(this.brush.move, this.defaultXSelection);
            //this.brush.move(this.defaultSelection);
            this.callback.call(this.context, this.defaultSelection);
        }
    }
}

class Thumb extends DomElement {
    constructor(id, infosCandidat, size) {
        super('thumb' + id);
        this._orientation = 'right';
        this.size = size;
        //    this.position= { x:0 , y:-10000};
        this.container = d3.create('svg:g').classed(`thumb id_${id}`, true)
            .style('display', 'none');
        this.image = this.container.append('foreignObject')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', `${size}px`)
            .attr('height', `${size}px`);
        this.image.append('xhtml:img')
            .attr('width', `${size}px`)
            .attr('height', `${size}px`)
            .attr('src', `img/id_${id}.jpg`)
            .style('border-radius', '100%')
            .style('border', `4px solid ${infosCandidat.couleur}`);
        this.text = this.container.append('text')
            .attr('y', `${size / 1.33}px`)
            .attr('fill', infosCandidat.couleur)
            .attr('stroke', '#fff')
            .attr('stroke-width', '8px')
            .attr('paint-order', 'stroke')
            .style('font-size', `${size / 1.5}px`);
    }

    setValue(v) {
        v = parseInt(v * 10) / 10;
        this.text.text(`${v.toFixed(1).replace('.', ',')}%`);
        return this;
    }

    orientation(o = 'right') {
        this._orientation = o;
        return this;
    }

    move(x, y) {
        this.container.attr('y', 0).attr('transform', `translate(${x - this.size / 2} ${y - this.size / 2})`);
        this.text.attr('y', `${this.size / 1.33}px`)
        if (this._orientation == 'right') {
            this.text.attr('x', `${this.size + 10}px`).attr('text-anchor', 'start');
        } else {
            this.text.attr('x', `${-16}px`).attr('text-anchor', 'end');
        }
        return this;
    }

    hide() {
        this.container.style('display', 'none');
        return this;
    }

    show() {
        this.container.style('display', 'block');
        return this;
    }

    static hideAll(selection) {
        d3.selectAll('g.thumb')
            .style('display', 'none');
    }
}


class Poll extends DomElement {

    static size = {width: 1600, height: 1400};
    static margins = {top: 0, right: 80, bottom: 200, left: 300};
    static params = {duration: 1000, delay: 100};

    constructor(id) {
        super('Poll');
        //     if (id!==undefined) this.draw(id);
        this.data = {meta: undefined};
        this.container = d3.create('svg:g').classed('mainLayer', true)
            .attr('transform', `translate(${Poll.margins.left} ${Poll.margins.top})`);

        //Calcul des tailles effectives
        this.size = {
            font: d3.min([Poll.size.height / 20, 40]),
            width: (Poll.size.width - Poll.margins.left - Poll.margins.right),
            height: (Poll.size.height - Poll.margins.top - Poll.margins.bottom)
        }

        //Calques
        this.layers = {};
        this.layers.chart = this.container.append('svg:g').classed('chart', true);
        this.layers.labels = this.container.append('svg:g').classed('labels', true);
        this.layers.xAxis = this.container.append('svg:g').classed('xAxis axis', true);
        this.layers.yAxis = this.container.append('svg:g').classed('yAxis axis', true);
        //Transition de base
        this.transition = () => d3.transition().duration(Poll.params.duration).delay(Poll.params.delay);
        //Création des échelles et des axes
        this.scale = {x: undefined, y: undefined};
        this.scale.y = d3.scaleBand().range([0, this.size.height]).padding(.2);
        this.scale.x = d3.scaleLinear().rangeRound([0, this.size.width * .90]);
        this.domain = {x: undefined, _x: undefined};
        this.axisGenerator = {x: undefined, y: undefined};
        this.axisGenerator.x = d3.axisBottom(this.scale.x).tickFormat(d => d + '%').tickSizeOuter(0);
        this.axisGenerator.y = d3.axisLeft(this.scale.y).tickSize(0).tickFormat(d => this.data.candidats.get(d).patronyme);
    }


    /**
     * Injecte les données dans la propriété this.data
     * @param property
     * @param dataWrapper
     * @returns {MetaPoll}
     */
    push(property, data) {
        if (!data[property]) this.data[property] = data;
        return this;
    }

    setDomain(max) {
        this.domain._x = [0, max];
        return this;
    }


    _domain() {
        let xDomain = this.domain._x || [0, d3.max(this.dataset, d => d.borne_sup)];
        this.scale.y.domain(this.dataset.map(d => d.id_candidat));
        this.scale.x.domain(xDomain);
        this.axisGenerator.x.tickValues(d3.range(0, xDomain[1], 5));
        //Ajuste la hauteur du graphique si les barres deviennent trop épaisses
        this.bandwidth=Math.min(this.scale.y.bandwidth(), this.size.height / 15);
        let newHeight=this.bandwidth*this.scale.y.domain().length+this.bandwidth*(this.scale.y.domain().length+1)*.2;
        this.scale.y.range([0,newHeight]);
        console.log(this.scale.y.domain(),this.scale.y.range());
        this.layers.xAxis.attr('transform',`translate(0 ${newHeight})`);
        this.parent.transition().duration(1000).attr('viewBox', `0 0 1600 ${newHeight+100}`);
      /*  if (this.scale.y.bandwidth() > this.size.height / 10) {
            const newHeight = (G_sondages.selection_candidats.length) * this.size.height / 10;
            this.scale.y.range([0, newHeight]);
           // this._resize(newHeight + Poll.margins.top);
            console.log(newHeight, this.scale.y.bandwidth());
        }*/
        return this;
    }

    /**
     *
     * @private
     */
    _resize(height) {
        this.parent.transition().duration(1000).attr('viewBox', `0 0 1600 ${height + Poll.margins.bottom}`);
        this.layers.xAxis.attr('transform', `translate(0 ${this.size.height})`);
        this.update();
        return this;
    }

    update(dataset) {
        if (dataset) {
            this.dataset = dataset
                .filter(d => G_sondages.selection_candidats.includes(`id_${d.id_candidat}`))
                .sort((a, b) => d3.descending(a.resultat, b.resultat));
        }
        this._domain()
            ._updateBars()
            ._updateLabels()
            ._updateXAxis()
            ._updateYAxis()
            ._updateMarks();
        return this;
    }

    _updateBars() {
        this.layers.chart
            .selectAll('.bar')
            .data(this.dataset)
            .join(
                enter => enter
                    .append('rect')
                    .attr('class', d => `bar id_${d.id_candidat}`)
                    .attr('x', 0)
                    .attr('y', d => this.scale.y(d.id_candidat))
                    .attr('width', 2)
                    .attr('height', this.scale.y.bandwidth())  // this.scale.y.bandwidth()
                    .each(d => this._updateGradient(d))
                    .attr('fill', d => 'url(#gradient' + d.id_candidat + ')')
                    .transition(this.transition)
                    .attr('width', d => this.scale.x(d.borne_sup)),
                update => update
                    .transition(this.transition)
                    .attr('class', d => `bar id_${d.id_candidat}`)
                    .attr('y', d => this.scale.y(d.id_candidat))
                    .attr('width', d => this.scale.x(d.borne_sup))
                    .attr('height', this.scale.y.bandwidth()) // this.scale.y.bandwidth()
                    .each(d => this._updateGradient(d))
                    .attr('fill', d => 'url(#gradient' + d.id_candidat + ')'),
                exit => exit.remove()
            );
        return this;
    }

    _updateMarks() {
        this.layers.chart
            .selectAll('.mark')
            .data(this.dataset)
            .join(
                enter => enter
                    .append('rect')
                    .attr('class', d => `mark id_${d.id_candidat}`)
                    .style('opacity', 0)
                    .attr('x', d => this.scale.x(d.resultat))
                    .attr('y', d => this.scale.y(d.id_candidat) - this.scale.y.bandwidth() * .1)
                    .attr('width', `${this.size.font / 2}px`)
                    .attr('height', this.scale.y.bandwidth() * 1.2)
                    .attr('fill', d => d3.color(this.data.candidats.get(d.id_candidat).couleur))
                    .attr('stroke', 'white')
                    .attr('stroke-width', '4px')
                    .transition()
                    .delay(Poll.params.duration)
                    .style('opacity', 1),
                update => update
                    .style('opacity', 0)
                    .attr('x', d => this.scale.x(d.resultat))
                    .attr('y', d => this.scale.y(d.id_candidat) - this.scale.y.bandwidth() * .1)
                    .attr('height', this.scale.y.bandwidth() * 1.2)
                    .attr('fill', d => d3.color(this.data.candidats.get(d.id_candidat).couleur))
                    .transition()
                    .delay(Poll.params.duration)
                    .style('opacity', 1),
                exit => exit.remove()
            );
        return this;
    }


    _updateGradient(data) {
        if (data !== undefined && data.borne_sup && data.resultat) {
            const color = d3.color(this.data.candidats.get(data.id_candidat).couleur),
                gradient = this.parent.select('defs').select(`#gradient${data.id_candidat}`),
                [borne_inf, resultat] = [100 * data.borne_inf / data.borne_sup, 100 * data.resultat / data.borne_sup];
            const createStop = (offset, color, opacity) => {
                gradient.append('stop')
                    .attr('offset', `${offset}%`)
                    .attr('stop-color', color)
                    .attr('stop-opacity', opacity);
            }
            gradient.selectAll('stop').remove();
            createStop(0, color, .8);
            createStop(borne_inf, color, .6);
            createStop(borne_inf + .1, color, 1);
            createStop(resultat, color, .7);
            createStop(100, color, 1);
        }
        return this;
    }

    _updateLabels() {
        const fontSize = Math.min(this.scale.y.bandwidth() / 1.5, 40);
        this.layers.labels
            .selectAll('.label')
            .data(this.dataset)
            .join(
                enter => enter
                    .append('text')
                    .attr('class', d => `label id_${d.id_candidat}`)
                    .style('opacity', 0)
                    .style('dominant-baseline', 'middle')
                    .style('font-size', `${fontSize}px`)
                    .attr('x', d => this.scale.x(d.borne_sup) + fontSize)
                    .attr('y', d => this.scale.y(d.id_candidat) + this.scale.y.bandwidth() / 2)
                    .attr('fill', d => this.data.candidats.get(d.id_candidat).couleur)
                    .attr('dominant-baseline', 'middle')
                    .attr('stroke', '#fff')
                    .attr('stroke-width', '8px')
                    .attr('paint-order', 'stroke')
                    .text(d => d.resultat + '%')
                    .transition()
                    .duration(Poll.params.duration * 2)
                    .style('opacity', 1),
                update => update
                    .attr('class', d => `label id_${d.id_candidat}`)
                    .style('opacity', 0)
                    .attr('x', d => this.scale.x(d.borne_sup) + fontSize)
                    .attr('y', d => this.scale.y(d.id_candidat) + this.scale.y.bandwidth() / 2)
                    .text(d => d.resultat + '%')

                    .transition()
                    .duration(Poll.params.duration * 2)
                    .attr('fill', d => this.data.candidats.get(d.id_candidat).couleur)

                    .style('opacity', 1),
                exit => exit
                    .transition()
                    .duration(Poll.params.duration)
                    .style('opacity', 0)
                    .remove()
            )
        return this;
    }

    _updateXAxis() {
        this.layers.xAxis
            .transition()
            .duration(Poll.params.duration)
            .delay(Poll.params.delay)
            .call(this.axisGenerator.x)
            .call(g => g.selectAll('text')
                .style('font-size', `${this.size.font}px`)
            );
        return this;
    }

    _updateYAxis() {
        this.layers.yAxis
            .transition()
            .duration(Poll.params.duration)
            .delay(Poll.params.delay)
            .call(this.axisGenerator.y)
            .call(g => g.selectAll('text')
                .attr('dx', `${-this.size.font / 2}px`)
                .style('font-size', `${this.size.font}px`)
                .style('fill', d => this.data.candidats.get(d).couleur)
            );

        return this;
    }


}

class PollController {
    constructor(data, candidats) {
        //Singleton
        if (PollController._instance) {
            return PollController._instance;
        }
        PollController._instance = this;
        //Constructeur
        this.fullDataset = data;
        this.container = d3.select('div#conteneur_sondage');
        this.svg = this.container.select('svg');
        //Creation des gradients pour les barres
        const def = this.svg.append('defs');
        for (let [id, value] of candidats.entries()) {
            let gradient = def.append('linearGradient')
                .attr('id', `gradient${id}`)
                .attr('x1', 0).attr('x2', 1).attr('y1', 0).attr('y2', 0);
            gradient.append('stop').attr('offset', '0%').attr('stop-color', value.couleur).attr('stop-opacity', .5);
            gradient.append('stop').attr('offset', '100%').attr('stop-color', value.couleur).attr('stop-opacity', 1);
        }
        this.poll = new Poll()
            .push('candidats', candidats)
            .appendTo(this.svg);
        this.handler = this.svg.append('rect')
            .attr('id', 'swipeHandler')
            .attr('class', 'handler')
            .attr('x', 0).attr('y', 0)
            .attr('width', Poll.size.width).attr('height', Poll.size.height);
    }


    filterByDate(date) {
        this.index = 0;
        this.data = this.fullDataset.filter((d) => PollController._compareDates(d.debut, date)).dataset;
        this._updateDomain();
        this.data = d3.group(this.data, (d) => d.id_hypothèse);
        this.keys = Array.from(this.data.keys());
        this._updateMeta()
            ._updateHeader()
            ._createTriggers();
        return this;
    }

    draw() {
        this.poll.update(this.data.get(this.keys[0]));
        return this;
    }

    _updateDomain() {
        const max = d3.max(this.data, d => d.borne_sup);
        this.poll.setDomain(max);
        return this;
    }

    _updateMeta() {
        this.meta = new Map();
        for (let key of this.data.keys()) {
            const sondage = G_sondages.tables.sondages [`id_${G_sondages.tables.hypotheses_1[`id_${key}`].id_sondage}`];
            const value = {
                nom: undefined,
                institut: undefined,
                echantillon: undefined,
                s_echantillon: undefined,
                population: undefined,
                commanditaire: undefined,
                fin: undefined,
                lien: undefined
            };
            value.nom = G_sondages.tables.hypotheses_1[`id_${key}`].nom_hyp;
            value.s_echantillon = parseInt(G_sondages.tables.hypotheses_1[`id_${key}`].s_echantillon);
            value.commanditaire = sondage.commanditaire;
            value.lien = sondage.lien;
            value.echantillon = sondage.echantillon;
            value.debut = new Date(sondage.debut);
            value.fin = new Date(sondage.fin);
            value.institut = G_sondages.tables.instituts[`id_${sondage.id_institut}`];
            value.population = G_sondages.tables.populations[`id_${sondage.id_population}`];
            this.meta.set(key, value);
        }
        return this;
    }

    _createTriggers() {
        this.container.select('header span.previous')
            .on('click', (e) => {
                if (this.index > 0) {
                    this._next();
                }

            });
        this.container.select('header span.next')
            .classed('active', () => this.keys.length > 1)
            .on('click', (e) => {
                if (this.index < (this.keys.length - 1)) {
                    this._previous();
                }

            });
        let [handlerWidth, touchStart, touchMove] = [parseInt(this.handler.node().getBoundingClientRect().width), undefined, undefined];
        this.handler
            .on('touchstart', function (e) {
                touchStart = e.touches[0].clientX;

                e.preventDefault();
            })
            .on('touchmove', (e) => {
                touchMove = e.touches[0].clientX;
            })
            .on('touchend', (e) => {
                const offset = (touchMove - touchStart) / handlerWidth;
                if (Math.abs(offset) > .5) {
                    if (offset > 0 && this.index < (this.keys.length - 1)) {
                        this._previous();
                    } else if (offset < 0 && this.index > 0) {
                        this._next();
                    }
                }
            });
        return this;
    }

    _next() {
        //console.log('next',this.index,this.index+1);
        const key = this.keys[--this.index];
        this._updateHeader();
        this.poll.update(this.data.get(key));
        this.container.select('header span.next').classed('active', true);
        if (this.index == 0) this.container.select('header span.previous').classed('active', false);
        return this;
    }

    _previous() {
        // console.log('previous',this.index,this.index-1);
        const key = this.keys[++this.index];
        this._updateHeader();
        this.poll.update(this.data.get(key));
        this.container.select('header span.previous').classed('active', true);
        if (this.index == this.keys.length - 1) this.container.select('header span.next').classed('active', false);
        return this;
    }

    /**
     * Met à jour la titraille du sondage
     * @param key {Number} : id de l'hypothese
     * @private
     *
     */
    _updateHeader() {

        const infos = this.meta.get(this.keys[this.index]),
            t = d3.transition().duration(Poll.params.duration / 2),
            updateText = (selection, text) => {
                let oldText = this.container.select(selection).text();
                if (oldText !== text)
                    this.container.select(selection)
                        .transition(t)
                        .style('opacity', 0)
                        .transition(t)
                        .style('opacity', 1)
                        .text(text);
            };
        let note = `Sondage ${infos.institut} pour ${infos.commanditaire}. `;
        note += `Enquête réalisée du ${d3.timeFormat('%A %d %B %Y')(infos.debut)} au ${d3.timeFormat('%A %d %B %Y')(infos.fin)} auprès d'un échantillon de ${infos.echantillon} personnes.`;
        updateText('h3 span.institut', `Sondage ${infos.institut} du ${d3.timeFormat('%d/%m/%Y')(infos.debut)}`);
        updateText('h4.hypothese', infos.nom);
        updateText('p.note span.fiche', note);
        this.container.select('p.note a.lien')
            .transition(t)
            .style('opacity', 0)
            .transition(t)
            .style('opacity', 1)
            .attr('href', `${infos.lien}`);
        return this;
    }


    static _compareDates(a, b) {
        return (d3.timeFormat('%x')(a) === d3.timeFormat('%x')(b));
    }


}


export {DataWrapper, MetaPoll, Candidat, PollController};