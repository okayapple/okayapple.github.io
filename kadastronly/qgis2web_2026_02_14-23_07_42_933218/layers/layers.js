var wms_layers = [];


        var lyr_Google_0 = new ol.layer.Tile({
            'title': 'Google',
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
                popuplayertitle: 'кадастр',
                interactive: false,
                title: '<img src="styles/legend/_1.png" /> кадастр'
            });

lyr_Google_0.setVisible(true);lyr__1.setVisible(true);
var layersList = [lyr_Google_0,lyr__1];
lyr__1.set('fieldAliases', {'fid': 'fid', 'cadnum': 'cadnum', 'category': 'category', 'use': 'use', 'area': 'area', 'ownership': 'ownership', 'сільр': 'сільр', 'от АС�': 'от АС�', 'от Хо�': 'от Хо�', 'архив': 'архив', 'сосед': 'сосед', 'сосе_1': 'сосе_1', 'сосе_2': 'сосе_2', 'сосе_3': 'сосе_3', 'земба': 'земба', 'земб_1': 'земб_1', 'земб_2': 'земб_2', 'земб_3': 'земб_3', 'земб_4': 'земб_4', 'земб_5': 'земб_5', 'земб_6': 'земб_6', 'земб_7': 'земб_7', 'земб_8': 'земб_8', 'земб_9': 'земб_9', 'земб10': 'земб10', 'земб11': 'земб11', 'земб12': 'земб12', });
lyr__1.set('fieldImages', {'fid': '', 'cadnum': '', 'category': '', 'use': '', 'area': '', 'ownership': '', 'сільр': '', 'от АС�': '', 'от Хо�': '', 'архив': '', 'сосед': '', 'сосе_1': '', 'сосе_2': '', 'сосе_3': '', 'земба': '', 'земб_1': '', 'земб_2': '', 'земб_3': '', 'земб_4': '', 'земб_5': '', 'земб_6': '', 'земб_7': '', 'земб_8': '', 'земб_9': '', 'земб10': '', 'земб11': '', 'земб12': '', });
lyr__1.set('fieldLabels', {'fid': 'no label', 'cadnum': 'no label', 'category': 'no label', 'use': 'no label', 'area': 'no label', 'ownership': 'no label', 'сільр': 'no label', 'от АС�': 'no label', 'от Хо�': 'no label', 'архив': 'no label', 'сосед': 'no label', 'сосе_1': 'no label', 'сосе_2': 'no label', 'сосе_3': 'no label', 'земба': 'no label', 'земб_1': 'no label', 'земб_2': 'no label', 'земб_3': 'no label', 'земб_4': 'no label', 'земб_5': 'no label', 'земб_6': 'no label', 'земб_7': 'no label', 'земб_8': 'no label', 'земб_9': 'no label', 'земб10': 'no label', 'земб11': 'no label', 'земб12': 'no label', });
lyr__1.on('precompose', function(evt) {
    evt.context.globalCompositeOperation = 'normal';
});