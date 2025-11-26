var wms_layers = [];


        var lyr_Google_0 = new ol.layer.Tile({
            'title': 'Google карта',
            'opacity': 0.800000,
            
            
            source: new ol.source.XYZ({
            attributions: ' ',
                url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
            })
        });
var format__1 = new ol.format.GeoJSON();
var features__1 = format__1.readFeatures(json__1, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource__1 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource__1.addFeatures(features__1);
var lyr__1 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource__1, 
                style: style__1,
                popuplayertitle: 'лес',
                interactive: false,
    title: 'лес<br />\
    <img src="styles/legend/_1_0.png" /> кадастр контур<br />\
    <img src="styles/legend/_1_1.png" /> лес<br />\
    <img src="styles/legend/_1_2.png" /> в обработке<br />' });

lyr_Google_0.setVisible(true);lyr__1.setVisible(true);
var layersList = [lyr_Google_0,lyr__1];
lyr__1.set('fieldAliases', {'fid': 'fid', 'cadnum': 'cadnum', 'category': 'category', 'use': 'use', 'area': 'area', 'ownership': 'ownership', 'сільр': 'сільр', 'лес': 'лес', });
lyr__1.set('fieldImages', {'fid': 'TextEdit', 'cadnum': 'TextEdit', 'category': 'TextEdit', 'use': 'TextEdit', 'area': 'TextEdit', 'ownership': 'TextEdit', 'сільр': 'TextEdit', 'лес': 'ValueMap', });
lyr__1.set('fieldLabels', {'fid': 'no label', 'cadnum': 'no label', 'category': 'no label', 'use': 'no label', 'area': 'no label', 'ownership': 'no label', 'сільр': 'no label', 'лес': 'no label', });
lyr__1.on('precompose', function(evt) {
    evt.context.globalCompositeOperation = 'normal';
});