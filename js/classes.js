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
        return (type == "Map") ?
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
        return (this.primary) ? this.dataset.find((d) => d[this.primary] == id) : this.dataset[id];
    }

    /**
     * Cherche et renvoie la ligne de données où key=value
     * @param key
     * @param value
     * @returns {*}
     */
    find(key, value) {
        return this.dataset.find((d) => d[id] == value);
    }

    /**
     * Cherche et renvoie les lignes de données où key=value
     * @param key
     * @param key
     * @param value
     * @returns {*}
     */
    findAll(key, value) {
        return this.dataset.filter((d) => d[id] == value);
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
        extract.forEach((row, i) => {
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

    constructor() {
        this.size = {width: 1600, height: 800};
        this.margins = {top: 50, right: 50, bottom: 100, left: 50};
        this.svg = d3.select('#conteneur_graphique')
            .append("svg:svg")
            .attr('id', 'motherOfPolls')
            .attr(`preserveAspectRatio`, 'xMaxYMin meet')
            .attr('viewBox', `0 0 ${this.size.width} ${this.size.height}`)
            .attr('width', `100%`);
        this.container = this.svg
            .append('svg:g')
            .classed('mainLayer', true)
            .attr('transform', `translate(${this.margins.left} ${this.margins.top})`);
        this.data = {};
        //Détermine la taille effective (une fois enlevées les marges)
        this.size.font = this.size.width / 80;
        this.size.width = (this.size.width - this.margins.left - this.margins.right);
        this.size.height = (this.size.height - this.margins.top - this.margins.bottom);

        //Création des calques
        this.layers = {};
        this.layers.xAxis = this.container.append('svg:g').attr('id', 'xAxis').classed('axis', true);
        this.layers.yAxis = this.container.append('svg:g').attr('id', 'yAxis').classed('axis', true);
        this.layers.dots = this.container.append('svg:g').attr('id', 'dots');
    }

    push(property, dataWrapper) {
        this.data[property] = dataWrapper;
        return this;
    }


    draw() {

        /* Test
        this.data.chiffres.filters.add( "test",(d)=> d.candidat==11 ); //teste selection canddiat 0 uniquement
        console.log(this.data.chiffres.col('intentions'));
         */

        //this.data.resultats.filters.add("tour1", (d) => d.tour == 1); //Filtre chiffres du premier tour

        //Calcule les domaines (et les élargit un peu)
        this.xDomain = this.data.resultats.extent('debut');
        this.xDomain[0] = new Date(this.xDomain[0].getTime()).setUTCDate(1);

        this.yDomain = this.data.resultats.extent('resultat');
        this.yDomain[0] = 0;
        this.yDomain[1] = this.yDomain[1] + 5;

        this.xScale = d3.scaleTime()
            .range([0, this.size.width])
            .domain(this.xDomain);

        this.yScale = d3.scaleLinear()
            .range([this.size.height, 0])
            .domain(this.yDomain);

        this._drawAxis()
            ._drawDots();
    }

    _drawAxis() {

        let dateFn=d3.timeFormat('%b %Y');
        this.layers
            .xAxis
            .attr('transform', `translate(0 ${this.size.height})`)
            .call(d3.axisBottom(this.xScale).ticks(15).tickFormat(x => dateFn(x)))
            .selectAll('text')
            .style('font-size', this.size.font)
            .style('text-transform', 'capitalize')
            .attr('transform', 'rotate(50) translate(0 5)')
            .style('text-anchor', 'start');
        this.layers
            .yAxis
            .call(d3.axisLeft(this.yScale).tickFormat(x => x + '%'))
            .selectAll('text')
            .style('font-size', this.size.font)
            .style('text-anchor', 'end');
        return this;
    }

    _drawDots() {
        this.layers
            .dots
            .selectAll('circle')
            .data(this.data.resultats.dataset)
            .enter()
            .append('circle')
                .attr("cx", d => this.xScale(d.debut))
                .attr("cy", d => this.yScale(d.resultat))
                .attr("r", 3)
                .style('opacity', .3)
                .style('fill',(d)=> this.data.couleurs.get(d.id_candidat))
                .append('title')
                .html(d => this.data.candidats.get(d.id_candidat).nom_candidat + ':' + d.resultat + '%');

    }

}


