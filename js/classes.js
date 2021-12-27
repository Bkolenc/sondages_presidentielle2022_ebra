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
                if (property === 'dataset') {
                    target._dataset.full = value;
                    target.filters.execute();
                } else target[property] = value;
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
        if (!Array.isArray(dataset) && dataset.constructor === Object) dataset = this._convertFromDict(dataset);
        this._dataset.filtered = this._dataset.full = dataset;
        this.keys = Object.keys(dataset[0]);
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
        this.dataset = this._dataset.full.sort((a, b) => d3.ascending(a[key], b[key]));
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
    static margins = {top: 50, right: 20, bottom: 150, left: 100};
    static params = {
        areaWidth: 1, areaOpacity: .3,
        pointsOpacity: .1, pointsRadius: 3,
        axis: {width: 1},
        curve: {minPts: 10, mode: d3.curveBasis, bandwidth: .2, width: 3},
        duration: 100

    };

    constructor(id) {
        super(id);
        //Recalcule la taille effective (une fois enlevées les marges)
        this.size = {
            width: (MetaPoll.size.width - MetaPoll.margins.left - MetaPoll.margins.right),
            height: (MetaPoll.size.height - MetaPoll.margins.top - MetaPoll.margins.bottom),
            mainContainer: {
                width: (MetaPoll.size.width - MetaPoll.margins.left - MetaPoll.margins.right),
                height: (MetaPoll.size.height - MetaPoll.margins.top - MetaPoll.margins.bottom) * .7,
                rHeight: (MetaPoll.size.height - MetaPoll.margins.top - MetaPoll.margins.bottom) / 40
            },
            brushContainer: {
                width: (MetaPoll.size.width - MetaPoll.margins.left - MetaPoll.margins.right),
                height: (MetaPoll.size.height - MetaPoll.margins.top - MetaPoll.margins.bottom) * .2
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
            .attr('id', 'brushLayer')
            .attr('transform', `translate(${MetaPoll.margins.left} ${this.size.mainContainer.height + this.size.font.normal * 5})`);

        //Objet data
        this.data = {
            resultats: undefined,
            candidats: undefined,
            sondages: undefined
        }

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

        // this.size.ribbonHeight = this.size.height / 15;        //Hauteur de l'axe des mois et des années
        //Handlers
          this.focusHandler = this._createHandler(
              'focusHandler',
              0,
              0,
              this.size.mainContainer.width,
              this.size.mainContainer.height-this.size.mainContainer.rHeight*4
          );

        //Scales
        this.xScale = d3.scaleTime().range([0, this.size.mainContainer.width]);
        this.yScale = d3.scaleLinear().range([this.size.mainContainer.height, 0]);


        //Zoom
        this._zoom = d3.zoom()
            .translateExtent([[0, 0], [this.size.mainContainer.width, this.size.mainContainer.height]])
            .on('zoom', this._handleZoom.bind(this));

        //Générateurs des axes
        this.xAxisGenerator = d3.axisBottom(this.xScale).tickSize(10).tickSizeOuter(0).tickFormat(d3.timeFormat("%x"));
//        this.xYearsGenerator = d3.axisBottom(this.xScale).ticks(d3.timeYear).tickSize(-this.size.mainContainer.height).tickFormat(d3.timeFormat("%Y")).tickSizeOuter(0);
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
        this._createClipPath('clipXAxis', 0, -MetaPoll.size.height, this.size.mainContainer.width, MetaPoll.size.height + 100);

        //Création des calques
        this.layers = {};
        //  this._createLayer('points');//.attr('clip-path', 'url(#clipChart)');
        this._createLayer('curves').attr('clip-path', 'url(#clipChart)');

        const xAxis = this._createLayer('xAxis', 'axis')
            .attr('transform', `translate(0 ${this.size.mainContainer.height})`)
            .attr('clip-path', 'url(#clipXAxis)');
        this._createLayer('xDays', 'axis', xAxis);
        //   this._createLayer('xMonths', 'axis',xAxis);
        //  this._createLayer('xYears', 'axis',xAxis);
        // .attr('transform', `translate(${this.size.font.large} ${this.size.font.large*-1})`);

        const cache = this._createLayer('cache', 'cache');     //Hack degueu mais le clipping ne suit pas assez vite les modifs de la courbe
        cache.append('rect').attr('x', -MetaPoll.margins.left)
            .attr('y', -MetaPoll.margins.top).attr('width', MetaPoll.margins.left)
            .attr('height', MetaPoll.size.height);
        cache.append('rect')
            .attr('x', this.size.mainContainer.width)
            .attr('y', -MetaPoll.margins.top)
            .attr('width', MetaPoll.margins.right)
            .attr('height', MetaPoll.size.height);

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
                   d3.select(e.target).select('span.text').text(`${text} les marges d'erreur`);
                   this.toggle.areas(!state);
               });
           this._createSelector('Afficher le détail des estimations','insights')
               .on('click',(e,n)=> {
                   let state=this.toggle.points(),
                       text=(state)?'Afficher':'Masquer';
                   d3.select(e.target).select('span.text').text(`${text}  le détail des estimations`);
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
        const rect = this._createRect(x, y, width, height)
            .attr('id', id)
            .style('opacity', 0)
            .style('pointer-events', 'all')
            .raise();
        return this.mainContainer.append(() => rect.node());
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
            .append(() => rect.node());
    }

    /**
     * Crée et renvoie un rectangle SVG (méthode commune à _createHandler et _createClippath)
     * @param x {Number}: origine x du rectangle
     * @param y {Number}: origine y du rectangle
     * @param width {Number} : largeur du rectangle
     * @param height {Number} : hauteur du rectangle
     * @returns {*} : selection D3
     * @private
     */
    _createRect(x, y, width, height, className) {
        return d3.create('svg:rect')
            .attr('x', x)
            .attr('y', y)
            .attr('width', width)
            .attr('height', height)
            .classed(className, className);
    }

    /**
     * Injecte les données dans la propriété this.data
     * @param property
     * @param dataWrapper
     * @returns {MetaPoll}
     */
    push(property, data) {
        this.data[property] = data;
        return this;
    }

    /**
     * Calcule les domaines et les scales
     * @returns {MetaPoll}
     * @private
     */
    _calcDomainAndScales() {

        //Calcule les domaines (et les élargit un peu) et les échelles
        this.xDomain = this.data.resultats.extent('debut');
        this.xScale.domain(this.xDomain);
        this.xAxisGenerator.tickValues(this._getPollDates());

        this.yDomain = this.data.resultats.extent('borne_sup');
        this.yDomain = [0, (this.yDomain[1] + 1)];
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
    _getPollDates() {
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
     * @param e {Object} : objet passé this._zoom
     * @private
     */
    _handleZoom(e) {

        //Déplacement et zoom des courbes, modification inverse du clippath et du pattern
        let [x, k, ki] = [e.transform.x, e.transform.k, 1 / e.transform.k];
        d3.select('#curves').transition().duration(MetaPoll.params.duration).attr('transform', `translate(${x} 0) scale(${k} 1)`);
        //   d3.select('#pattern-stripe').transition().duration(MetaPoll.params.duration).attr('patternTransform',`rotate(45) scale(${ki} 1)`);
        //       d3.select('#clipChart rect').attr('transform',`translate(${-x/k} 0) scale(${ki} 1)`);   Remplacé par système de cache
        // d3.select('#points').transition().duration(MetaPoll.params.duration).attr('transform',`translate(${x} 0) scale(${k} 1)`);
        // d3.selectAll('#points ellipse').transition().duration(MetaPoll.params.duration).attr('transform',`scale(${ki} 1)`)

        //Déplacement et zoom des axes
        this.transform=e.transform;
        this._drawXAxis(e.transform);
        //this._drawXMonths(e.transform);
        //this._drawXYears(e.transform);

    }


    _zoomToRange(range) {
        let [begin, end] = range;
        begin = d3.max([begin, this.xDomain[0]]);
        end = d3.min([end, this.xDomain[1]]);
        let x = this.xScale;

        function zoomed() {
            var t = d3.event.transform, xt = t.rescaleX(x);
            //   g.select(".area").attr("d", area.x(function(d) { return xt(d.date); }));
            //  g.select(".axis--x").call(xAxis.scale(xt));
        }

        this.svg//.call(this._zoom)
            .call(this._zoom.transform, d3.zoomIdentity
                .scale(this.size.mainContainer.width / (x(end) - x(begin)))
                .translate(-x(begin), 0));


    }


    /**
     * Renvoie une fonction de régression correspondant aux points définis par la clé (resultat, borne_inf ou borne_sup)
     * @param key
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
     * Lance le tracé des courbes, de la marge d'erreur et des points
     */
    draw() {

        /* Test
        this.data.chiffres.filters.add( "test",(d)=> d.candidat==11 ); //teste selection canddiat 0 uniquement
        console.log(this.data.chiffres.col('intentions'));
         */


        //this.data.resultats.filters.add("recent", (d) => d.debut > new Date(2021, 7, 1));
        this._firstDraw = true;
        this._calcDomainAndScales()
            ._drawYAxis()
            ._drawXAxis()
            //  ._drawPoints()
            ._drawMainChart()
        this._drawBrushChart();

       this._enableFocus();

                                                 
        //Animation initiale (effet de rollover pour les courbes, puis affichage graduel des marges)
        anime({
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
                      },8000);*/

            }
        });
        return this;

    }


    /**
     * Lance une animation avec des vignettes
     * @private
     */
    _enableFocus() {
        const _this = this;
        const slider = this.mainContainer
                            .append('line')
                            .attr('x1', 0)
                            .attr('y1', 0)
                            .attr('x2', 0)
                            .attr('y2', this.size.mainContainer.height)
                            .style('stroke', 'rgba(128,128,128,.5')
                            .style('stroke-width', '6px');
        const updateSlider = (x, transition = false) => {
                    console.log(this.transform);    
                        console.log(x,this.xScale.invert(x));
            if (!transition) slider.attr('x1', x).attr('x2', x);

            else slider.transition().duration(500).attr('x1', x).attr('x2', x);
        }
        const thresholdX = (x) => {
            return (x < this.size.font) ? this.size.font :
                (x > this.size.mainContainer.width - this.size.font) ? this.size.mainContainer.width - this.size.font :
                    x;
        }
        const findClosest = (x) => {
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
            neighbors.filter(d => d)
                .filter(d => (this.xScale(d) > 0 && this.xScale(d) < this.size.mainContainer.width))
                .sort((a, b) => ((date - a) < (b - date)) ? -1 : 1);
            return ((neighbors[1] - date) < (date - neighbors[0])) ? neighbors.reverse() : neighbors;

        }

        const selectTick = (date) => {
            const tick = this.layers.xAxis.selectAll('g.tick.D' + date.toISOString().substring(0, 10)).raise();
            this.layers.xAxis.selectAll('text')
                .style('opacity', d => (d == date) ? .7 : 1)
                .style('font_size', `${this.size.font}px`);
            this.layers.xAxis.selectAll('line')
                .style('opacity', d => (d == date) ? .7 : 1);


        }
        const curveGen = d3.line()
            .x(d => this.xScale(d[0]))
            .y(d => this.yScale(d[1]))
            .curve(MetaPoll.params.curve.mode);
        const updateFigures = (x) => {
            for (let id of this.data.candidats.keys()) {
                let data = this.data.resultats.dataset.filter(d => d.id_candidat === id);
                if (data.length >= MetaPoll.params.curve.minPts) {      //Inutile de tracer une courbe si moins de x points
                    //Creation calque id_X
                    // console.log(curveGen);
                }
            }


        }


        d3.select('#focusHandler')
            .raise()
            .call(d3.drag()
                .on("start", function () {
                    console.log('drag');
                    d3.select(this).style('cursor', 'ew-resize');
                })
                .on("drag", (e) => {
                    let x = thresholdX(e.x);
                    updateSlider(x);

                    //updateFigures(x);
                    //  console.log(x,this.xScale.invert(x));
                })
                .on('end', (e) => {
                    d3.select('#focusHandler').style('cursor', 'default');
                    let x = thresholdX(e.x),
                        closestDate = findClosest(x)[0];
                    updateSlider(this.xScale(closestDate), true);
                    selectTick(closestDate);
                })
            );

        return this;
    }

    /**
     * Création de l'axe des abscisses
     * @param xScale
     * @returns {MetaPoll}
     * @private
     */
    _drawXAxis(transform) {
        //Définition de l'échelle et de la durée d'animation (0 au premier passage)
        const xScale = (transform) ? transform.rescaleX(this.xScale) : this.xScale;
        this.xAxisGenerator.scale(xScale);
        //Appel du générateur
        const xAxis = this.layers.xDays
            .call(this.xAxisGenerator)
            .on('end', () => d3.selectAll('#xAxis g.tick')
                .attr('class', d => 'tick D' + d.toISOString().substring(0, 10))
            );

        //Définition des styles lors du premier appel de la fonction uniquement
        if (this._firstDraw) {
            xAxis.selectAll('text')
                .attr('transform', 'translate(0 5) rotate(40)')
                .style('font-size', `${this.size.font.small}px`);
        }
        return this;
    }

    /**
     * Création de l'axe secondaire (mois) des abscisses
     * @param xScale
     * @param k {Number} : coefficient de zoom
     * @returns {MetaPoll}
     * @private
     */
    _drawXMonths(transform) {
        const xScale = (transform) ? transform.rescaleX(this.xScale) : this.xScale,
            height = this.size.font.normal * 1.5,
            duration = (this._firstDraw) ? 0 : MetaPoll.params.duration;

        //Renvoie les proprietés transform pour décaler les étiqyettes vers le centre de chaque case
        const getXTransform = (date) => {
            const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1),
                offsetX = (xScale(nextMonth) - xScale(date)) / 2;
            return `translate(${offsetX} ${this.size.font.normal * -1.1})`;
        }
        //Renvoie un rectangle de fond pour le mois correspondant à la date
        const newBackground = (date) => {
            const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1),
                width = xScale(nextMonth) - xScale(date);
            return this._createRect(xScale(date), 0, width, height, (date.getMonth() % 2 == 0) ? 'odd' : 'even');
        }
        //Création de l'axe des mois
        const axis = this.layers.xMonths;
        if (this._firstDraw) {                   //Premier passage
            const bckLayer = axis.append('g').classed('bck', true);
            axis.call(this.xMonthsGenerator.scale(xScale))
                .call(g => g.selectAll('text')
                    .style('font-size', `${height / 1.7}px`)
                    //.attr('transform', `translate(0 -${height * .75})`)
                    .attr('transform', getXTransform)
                    .each(function (date) {
                        bckLayer.append(() => newBackground(date).node());
                    })
                );
        } else if (transform) {                   //Transformation des élements
            axis.transition()
                .duration(duration)
                .call(this.xMonthsGenerator.scale(xScale));
            axis.selectAll('text')
                .style('font-size', `${height / 1.7}px`)
                .transition()
                .duration(duration)
                .attr('transform', getXTransform)
                .on('start', function (d) {       //Si la taille des labels doit diminuer, on applique la modification avant l'animation
                    d3.select(this).text((d) => {
                        let sourceText = this.textContent;
                        let targetText = (transform.k > 2) ? d3.timeFormat('%B')(d) :
                            (transform.k > 1.6) ? d3.timeFormat('%b')(d) :
                                d3.timeFormat('%b')(d).charAt(0);
                        return (targetText.length < sourceText.length) ? targetText : sourceText;
                    });
                })
                .on('end', function (d) {         //Modification de la taille des labels en fonction du niveau de zoom
                    d3.select(this).text(() => {
                        if (transform.k >= 2) return d3.timeFormat('%B')(d);
                        else if (transform.k >= 1.6) return d3.timeFormat('%b')(d);
                        else return d3.timeFormat('%b')(d).charAt(0);
                    });
                });
            axis.select('g.bck')                //Transformation des rectangles de fond
                .transition()
                .duration(MetaPoll.params.duration)
                .attr('transform', `translate(${transform.x} 0) scale(${transform.k} 1)`);
        }

        return this;
    }


    /**
     * Création de l'axe secondaire (année) des abscisses
     * @param transform
     * @returns {MetaPoll}
     * @private
     */
    _drawXYears(transform) {
        const xScale = (transform) ? transform.rescaleX(this.xScale) : this.xScale,
            duration = (this._firstDraw) ? 0 : MetaPoll.params.duration;
        // const xScale=this.xScale, duration=0;
        this.layers.xYears
            .transition()
            .duration(duration)
            .call(this.xYearsGenerator.scale(xScale))
            .call(g => g.selectAll('text')
                .attr('transform', `translate(${this.size.font.large / 10} ${this.size.font.large * -1})`)
                .style('font-size', `${this.size.font.large}px`));
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
                .style('stroke-width', 1);
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
    _drawMainChart(xScale) {
        xScale = xScale || this.xScale; //ENCORE UTILE???
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
            let data = this.data.resultats.dataset
                .filter(d => d.id_candidat === id);
            if (data.length >= MetaPoll.params.curve.minPts) {      //Inutile de tracer une courbe si moins de x points
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
            .style('stroke-width', MetaPoll.params.curve.width)
            .append('title')
            .html(`${this.data.candidats.get(id).nom} (${this.data.candidats.get(id).sigle})`);


    }

    _drawBrushChart() {
        const xScale = this.xScale,
            yScale = this.yScale.copy().range([this.size.brushContainer.height, 0]),
            xGenerator = d3.axisBottom(xScale).ticks(d3.timeMonth).tickFormat((d) => d3.timeFormat("%b")(d)).tickSizeOuter(0),
            height = this.size.font.small * 2,
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
        const getXTransform = (date) => {
            const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1),
                offsetX = (xScale(nextMonth) - xScale(date)) / 2;
            console.log();
            return (this.xScale.domain()[1]<nextMonth)? 'translate(-9000 -9000)':`translate(${offsetX} 0)`;
        }
        const createBackground = (date) => {
            const nextMonth = new Date(date.getFullYear(), date.getMonth() + 1, 1),
                width = xScale(nextMonth) - xScale(date);
            return this._createRect(xScale(date), 0, width, this.size.brushContainer.height, (date.getMonth() % 2 == 0) ? 'odd' : 'even');
        }
        const xAxis = this._createLayer('brushXAxis', 'axis', this.brushContainer)
                          .attr('transform', `translate(0 ${this.size.brushContainer.height})`);
        xAxis.call(xGenerator.scale(xScale))
            .call(g => g.selectAll('text')
                .style('font-size', `${this.size.font.small}px`)
                .attr('transform', getXTransform)
                .each(function (d) {
                    let bck=createBackground(d);
                    background.append(() => bck.node());
                })
            );

        //Creation brush
        new XBrushArea(this.brushContainer, this.xScale, this.yScale, this.size.brushContainer)
            .on('change', this._zoomToRange, this);

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


class Poll extends DomElement {

    static size = MetaPoll.size;
    static margins = {top: 150, right: 20, bottom: 150, left: 100};
    ;
    static duration = 500;

    constructor(id) {
        super(`Sondage_${id}`);
        this.id = id;
        this.hypothese = 1;
        this.data = {};
        //Recuperation et reformatage des données relatives au sondage
        this.infos = G_sondages.tables.sondages[`id_${id}`];
        this.infos.institut = G_sondages.tables.instituts[`id_${this.infos.id_institut}`];
        this.infos.hypotheses = new Map();
        Object.entries(G_sondages.tables.hypotheses_1)
            .filter(d => d[1].id_sondage == this.id)
            .forEach(d => {
                let key = parseInt(d[0].replace('id_', '')),
                    data = d[1];
                delete (data.id_sondage);
                data.s_echantillon = parseInt(data.s_echantillon);
                this.infos.hypotheses.set(key, data);
            });
        this.container = d3.create('svg:g').classed('mainLayer poll', true)
            .attr('transform', `translate(${Poll.margins.left} ${Poll.margins.top})`);
        this.layers = {};
        this.layers.chart = this.container.append('svg:g').classed('chart', true);
        this.layers.labels = this.container.append('svg:g').classed('labels', true);
        this.layers.axis = this.container.append('svg:g').classed('axis', true)
        //Calcul des tailles effectives
        this.size = {
            font: d3.min([MetaPoll.size.height / 20, 40]),
            width: (Poll.size.width - Poll.margins.left - Poll.margins.right),
            height: (Poll.size.height - Poll.margins.top - Poll.margins.bottom)
        }

        //Création des échelles et des axes
        this.xScale = d3.scaleBand().rangeRound([0, this.size.width]).padding(.2);
        this.yScale = d3.scaleLinear().rangeRound([this.size.height, 0]);
        this.axisGenerator = d3.axisLeft(this.yScale).tickFormat(x => x + '%').tickSizeOuter(0);
    }


    /**
     * Injecte les données dans la propriété this.data
     * @param property
     * @param dataWrapper
     * @returns {MetaPoll}
     */
    push(property, data) {
        this.data[property] = data;
        return this;
    }


    calcDomain(dataset) {
        this.xScale.domain(dataset.map(d => d.id_candidat));
        let min = d3.min(dataset, d => d.borne_inf);
        let max = d3.max(dataset, d => d.borne_sup) + 2;
        this.yScale.domain([0, max]);
        this.axisGenerator.tickValues(d3.range(0, max, 5));
        return this;
    }


    draw() {
        //   this.data.filters.add('hypothese', );
        let dataset = this.data.resultats.dataset
            .filter(d => d.id_hypothèse == this.hypothese)
            .sort((a, b) => d3.descending(a.resultat, b.resultat));
        this.calcDomain(dataset);

        dataset = d3.group(dataset, d => d.id_candidat);
        console.log(dataset);

        let groups = this.layers.chart
            .selectAll('g.cand')
            .data(dataset)
            .join('g')
            .attr('class', d => `cand id_${d[0]}`)
            .attr('transform', d => `translate(${this.xScale(d[0])} 0)`);
        groups.selectAll('rect.bar')
            .data(d => d[1])
            .join('rect')
            .attr('class', 'bar')
            .attr("x", 0)
            .attr("y", d => this.size.height)
            .attr("width", this.xScale.bandwidth())
            .attr("height", 0)
            .attr("fill", d => this.data.candidats.get(d.id_candidat).couleur)
            .style('opacity', .2)
            .transition()
            .duration(Poll.duration)
            .attr("y", d => this.yScale(d.resultat))
            .attr('height', d => this.size.height - this.yScale(d.resultat));
        groups.selectAll('line.result')
            .data(d => d[1])
            .join('line')
            .attr('class', 'result')
            .attr("x1", 0)
            .attr("y1", d => this.yScale(d.resultat))
            .attr("x2", 0)
            .attr("y2", d => this.yScale(d.resultat))
            .attr("stroke", d => this.data.candidats.get(d.id_candidat).couleur)
            .attr("stroke-width", '10px')
            .transition()
            .delay(Poll.duration)
            .attr("x2", this.xScale.bandwidth());
        groups.selectAll('rect.area')
            .data(d => d[1])
            .join('rect')
            .attr('class', 'area')
            .attr('mask', 'url(#mask-stripe)')
            .attr("x", 0)
            .attr("y", d => this.yScale(d.resultat))
            .attr("width", this.xScale.bandwidth())
            .attr("height", d => 0)
            .attr("fill", d => this.data.candidats.get(d.id_candidat).couleur)
            .transition()
            .delay(Poll.duration)
            .duration(Poll.duration)
            .attr("y", d => this.yScale(d.borne_sup))
            .attr("height", d => this.yScale(d.borne_inf) - this.yScale(d.borne_sup))
            .style('opacity', .2);
        groups.selectAll('text.result')
            .data(d => d[1])
            .join('text')
            .attr('class', 'result')
            .attr('x', this.xScale.bandwidth() / 2)
            .attr('y', d => this.yScale(d.resultat) - this.size.font / 2)
            .style('font-size', `${this.size.font}px`)
            .attr("fill", d => this.data.candidats.get(d.id_candidat).couleur)
            .transition()
            .delay(Poll.duration * 2)
            .text(d => `${d.resultat}%`);
        groups.selectAll('foreignObject.thumb')
            .data(d => d[1])
            .join('foreignObject')
            .attr('class', 'thumb')
            .attr('x', 0)
            .attr('y', d => this.yScale(d.borne_sup) - this.size.font - this.xScale.bandwidth())
            .attr('width', this.xScale.bandwidth())
            .attr('height', this.xScale.bandwidth())
            .append('xhtml:img')
            .attr('width', this.xScale.bandwidth())
            .attr('height', this.xScale.bandwidth())
            .transition()
            .delay(Poll.duration * 2)
            .attr('src', d => 'img/id_' + d.id_candidat + '.jpg');
        this.layers.axis
            .call(this.axisGenerator)
            .call(g => g.selectAll('text')
                .style('font-size', `${this.size.font}px`)
            );
        this.layers.axis
            .append('line')
            .attr('x1', 0)
            .attr('x2', this.size.width)
            .attr('y1', this.size.height)
            .attr('y2', this.size.height);

        return this;

    }

    update() {
        let dataset = this.data.resultats.dataset
            .filter(d => d.id_hypothèse == this.hypothese)
            .sort((a, b) => d3.descending(a.resultat, b.resultat));
        this.calcDomain(dataset);

        dataset = d3.group(dataset, d => d.id_candidat);
        console.log(dataset);

        this.layers.chart
            .selectAll('g.cand')
            .data(dataset, d => d)
            .join(
                enter => enter.append('g')
                    .attr('class', d => `cand id_${d[0]}`)
                    .attr('transform', d => `translate(${this.xScale(d[0])},0)`)
                    .append('line')
                    .attr('class', d => 'result c' + d[0])
                    .attr("x1", 0)
                    .attr("y1", d => this.yScale(d[1][0].resultat))
                    .attr("x2", this.xScale.bandwidth())
                    .attr("y2", d => this.yScale(d[1][0].resultat))
                    .attr("stroke", d => {
                        console.log(d[0], this.data.candidats.get(d[0]));
                        return this.data.candidats.get(d[0]).couleur;
                    })
                    .attr("stroke-width", '10px')
                ,
                update => update
                    // .each ( d=> console.log('UPDATE ',d[1][0].id_candidat,this.data.candidats.get(d[1][0].id_candidat).nom, ' >'+d[1][0].resultat))
                    //     .transition()
                    //    .duration(Poll.duration)
                    .attr('transform', d => `translate(${this.xScale(d[0])} 0)`)
                /*  .call ( update => update
                          .selectAll('line.result')
                          .call( line => line
                              .transition()
                              .duration(Poll.duration)
                              .attr( 'x2' , this.xScale.bandwidth() )
                          )
                                     /* .selectAll('line.result')
                                      .transition()
                                      .duration(Poll.duration)
                                      .attr( 'x2' , this.xScale.bandwidth() )
                                      .attr( 'y1' ,d => {
                                          console.log(d);
                                          let id=(Array.isArray(d))?d[1][0].id_candidat:d.id_candidat,
                                              infos=dataset.get(id)[0];
                                          console.log(infos);
                                         return this.yScale(infos.resultat);
                                      } )
                                      .attr('y2',d => {
                                          let id=(Array.isArray(d))?d[1][0].id_candidat:d.id_candidat,
                                              infos=dataset.get(id)[0];
                                           return this.yScale(infos.resultat);
                                      }  )*/
                //  ),
                ,
                exit => exit.remove()
            );

        /*        const bars=this.mainContainer.selectAll("rect.bar").data(dataset);
                bars.exit().remove();
                bars.enter()
                    .append('rect')
                    .classed('bar',true);
                bars.transition()
                    .duration(Poll.duration)
                    .attr("x", d => this.xScale(d.id_candidat))
                    .attr("y", d =>  this.yScale(d.resultat))
                    .attr("width", this.xScale.bandwidth())
                    .attr("height", d=> this.size.height-this.yScale(d.resultat) );

               const areas=this.mainContainer.selectAll("rect.area").data(dataset);
                areas.exit().remove();
                areas.enter()
                    .append('rect')
                    .classed('area',true);
                areas.transition()
                    .duration(Poll.duration)
                    .attr("x", d => this.xScale(d.id_candidat))
                    .attr("y", d =>  this.yScale(d.borne_sup))
                    .attr("width", this.xScale.bandwidth())
                    .attr("height", d => this.yScale(d.borne_inf) - this.yScale(d.borne_sup) );*/
        /*
                const lines=this.mainContainer
                    .selectAll("line.result")
                    .data(dataset, d=>d)
                    .join(
                        enter =>    enter.append('line')
                                        .attr('class', d => `result id_${d.id_candidat}`)

                                        .attr("stroke", d => this.data.candidats.get(d.id_candidat).couleur)
                                        .attr("stroke-width", '10px')
                                        .call(enter => enter
                                                        .transition()
                                                        .duration(Poll.duration)
                                            .attr("x1", d => this.xScale(d.id_candidat))
                                            .attr("y1", d =>  this.yScale(d.resultat))
                                            .attr("x2", d =>  this.xScale(d.id_candidat)+this.xScale.bandwidth() )
                                            .attr("y2", d =>  this.yScale(d.resultat) )
                                        )
                                        .each( d=> console.log('ENTER '+d.id_candidat,
                                            this.data.candidats.get(d.id_candidat).nom,
                                            d.resultat,this.xScale(d.id_candidat),
                                            this.yScale(d.resultat)
                                        )),
                        update =>   update
                                    .attr("x1", d => this.xScale(d.id_candidat))
                                    .attr("y1", d =>  this.yScale(d.resultat))
                                    .attr("x2", d =>  this.xScale(d.id_candidat)+this.xScale.bandwidth() )
                                    .attr("y2", d =>  this.yScale(d.resultat))
                                        .each( d=> console.log('UPDATE '+d.id_candidat,
                                                this.data.candidats.get(d.id_candidat).nom,
                                                d.resultat,this.xScale(d.id_candidat),
                                                this.yScale(d.resultat)
                                            )),
                        exit =>     exit.remove()
            );
             /*   lines.exit().remove();
                lines.enter()
                    .append('line')
                    .classed('result',true)
                    .attr("x1", d => this.xScale(d.id_candidat))
                    .attr("y1", d =>  this.yScale(d.resultat))
                    .attr("x2", d =>  this.xScale(d.id_candidat) )
                    .attr("y2", d =>  this.yScale(d.resultat) )
                    .attr("stroke", d => this.data.candidats.get(d.id_candidat).couleur)
                    .attr("stroke-width", '10px')
                    .each( d=> console.log(d.id_candidat,this.data.candidats.get(d.id_candidat).nom,d.resultat,this.xScale(d.id_candidat),this.yScale(d.resultat)));
                lines
                    //.transition()
                    //.duration(Poll.duration)
                    .attr("x1", d => this.xScale(d.id_candidat))
                    .attr("y1", d =>  this.yScale(d.resultat))
                    .attr("x2", d =>  this.xScale(d.id_candidat)+ this.xScale.bandwidth() )
                    .attr("y2", d =>  this.yScale(d.resultat) );

            /*    const labels=this.mainContainer.selectAll("text.name").data(dataset);
                labels.exit().remove();
                labels.enter()
                    .append('line')
                    .classed('name',true);
                labels.transition()
                    .duration(Poll.duration)
                    .attr('x',d => this.xScale(d.id_candidat)+this.xScale.bandwidth()/2)
                    .attr('y',d => this.yScale(d.borne_sup)-15);*/

        this.layers.axis
            .transition()
            .duration(Poll.duration)
            .call(this.axisGenerator)
            .call(g => g.selectAll('text')
                .style('font-size', `${this.size.font}px`)
            );

        return this;
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
                        .style('opacity', (d, i, n) => (n[i].tagName == 'ellipse') ? MetaPoll.params.pointsOpacity : 1)
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
        return d3.select('#SuperPoll')
            .selectAll('g#curves,g#brushLayer')
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
        this.container = container;
        this.x = xScale;
        this.y = yScale.copy().range([size.height, 0]);
        this.size = size;
        this.defaultSelection = [this.x(new Date(this.x.domain()[1].setDate(this.x.domain()[1].getDate() - 30))), this.x.range()[1]];
        this.brush = d3.brushX()
            .extent([[0.1, 0.1], [size.width, size.height]])
            .on("brush", this.brushed.bind(this))
            .on("end", this.brushended);
    }

    on(action, callback, context) {
        this.callback = callback;
        this.context = context;
        this.container.call(this.brush)
            .call(this.brush.move, this.defaultSelection);
        return this;
    }

    brushed({selection}) {
        if (selection) {
            //console.log(selection);
            let [begin, end] = selection.map(this.x.invert).map(d3.utcDay.round);
            this.callback.call(this.context, [begin, end]);
            //   svg.property("value", selection.map(x.invert, x).map(d3.utcDay.round));
            //   svg.dispatch("input");
        }
    }

    brushended({selection}) {
        if (!selection) {
            // this.brushContainer.call(brush.move, defaultSelection);
        }
    }
}