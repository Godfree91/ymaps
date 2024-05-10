'use strict';

const Strings = {
    selectAddress: 'Выбрать адрес'
};

const addressAttributes = [
    'house',
    'street',
    'district',
    'locality',
    'area',
    'province',
];

class TelegramMap {

    static init() {
        window.telegramMap = new TelegramMap();
        window.telegramMap.initTg();
        ymaps.ready(window.telegramMap.initMap.bind(window.telegramMap));
    }

    constructor() {
        this._tg = window.Telegram.WebApp;
        this._map = null;
        this._address = null;
        this._geocodingResult = null;

        // Events.
        let me = this;
        Telegram.WebApp.onEvent('mainButtonClicked', function(){
            me._tg.sendData(JSON.stringify(me.getData()));
            me._tg.close();
        });

        // Get Telegram user ID.
        this._userId = new URLSearchParams(window.location.search).get('uid');
    }

    initTg() {
        this._tg.MainButton.text = Strings.selectAddress;
        this._tg.MainButton.show();
        this._tg.MainButton.disable();
    }

    initMap() {
        this._map = new ymaps.Map("map", {
            center: [55.76, 37.64],
            zoom: 10,
            controls: [
                'searchControl',
                'zoomControl',
                'geolocationControl'
            ]
        });

        let searchControl = this._map.controls.get('searchControl');
        searchControl.events.add('resultshow', function (event) {
            let res = searchControl.getResultsArray()[event.get('index')];
            this._address = searchControl.getRequestString();
            this._geocodingResult = {
                address: res.properties._data.text,
                addressDetails: TelegramMap.extractComponents(
                    res.properties._data.metaDataProperty.GeocoderMetaData.Address.Components
                ),
                lat: res.geometry._coordinates[0],
                lon: res.geometry._coordinates[1]
            };
            this._tg.MainButton.enable();
        }, this);

        searchControl.events.add('clear', function () {
            this._address = null;
            this._geocodingResult = null;
            this._tg.MainButton.disable();
        }, this);

        this._map.events.add('click', function (e) {
            this._map.geoObjects.removeAll();
            this._map.controls.get('searchControl').clear();
            this._map.geoObjects.add(new ymaps.Placemark(e.get('coords')));
            this._geocode(e.get('coords'));
        }.bind(this));

        this._tg.ready();
        this.handleViewportChange();
        this._tg.onEvent('viewportChanged', this.handleViewportChange.bind(this));
    }

    handleViewportChange() {
        document.getElementById('map').style.height = `${this._tg.viewportHeight}px`;
        this._map.container.fitToViewport();
    }

    getData() {
        let address = null;
        if (this._address) {
            address = this._address.trim();
        }

        return {
            enteredAddress: address,
            receivedAddress: this._geocodingResult.address,
            receivedAddressDetails: this._geocodingResult.addressDetails,
            lat: this._geocodingResult.lat,
            lon: this._geocodingResult.lon,
            userId: this._userId
        }
    }

    /**
     * Make geocoding requests to Yandex Geocoder.
     *
     * @param {String|Array} term
     */
    _geocode(term) {
        let me = this;

        ymaps.geocode(term, {results: 1, json: true}).then(
            function(res) {
                if (res.GeoObjectCollection.featureMember.length < 1) {
                    me.geocodeError();
                } else {
                    me.geocodeCallback(res.GeoObjectCollection.featureMember[0]);
                }
            },
            function(err) {
                me.geocodeError();
            }
        );
    }

    static extractComponents(components) {
        let items = {};
        components.forEach(function(item) {
            if (addressAttributes.indexOf(item.kind) !== -1) {
                if (item.kind in this) {
                    if (!Array.isArray(this[item.kind])) {
                        this[item.kind] = [this[item.kind]];
                    }
                    this[item.kind].push(item.name);
                } else {
                    this[item.kind] = item.name;
                }
            }
        }, items);

        return items;
    }

    /**
     * Handles geocoding result.
     *
     * @param {Object} res
     */
    geocodeCallback(res) {
        let coords = res.GeoObject.Point.pos.split(' ').map(parseFloat);
        this._geocodingResult = {
            address: res.GeoObject.metaDataProperty.GeocoderMetaData.Address.formatted,
            addressDetails: TelegramMap.extractComponents(
                res.GeoObject.metaDataProperty.GeocoderMetaData.Address.Components
            ),
            lat: coords[1],
            lon: coords[0]
        };

        let placemark = this._map.geoObjects.get(0);
        placemark.properties.set('balloonContent', res.GeoObject.name);
        placemark.balloon.open();

        this._tg.MainButton.enable();
    }

    geocodeError() {
        this._geocodingResult = null;
        this._address = null;
        this._map.geoObjects.removeAll();
        this._tg.MainButton.disable();
    }

}


class Utils {

    static onDocumentReady(callback) {
        if (document.readyState !== 'loading') {
            callback();
        } else {
            document.addEventListener('DOMContentLoaded', () => callback());
        }
    }

}
