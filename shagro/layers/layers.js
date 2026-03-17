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
                popuplayertitle: 'интересны',
                interactive: false,
                title: '<img src="styles/legend/_1.png" /> интересны'
            });
var format__2 = new ol.format.GeoJSON();
var features__2 = format__2.readFeatures(json__2, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource__2 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource__2.addFeatures(features__2);
var lyr__2 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource__2, 
                style: style__2,
                popuplayertitle: 'не интересны',
                interactive: false,
                title: '<img src="styles/legend/_2.png" /> не интересны'
            });
var format__3 = new ol.format.GeoJSON();
var features__3 = format__3.readFeatures(json__3, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource__3 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource__3.addFeatures(features__3);
var lyr__3 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource__3, 
                style: style__3,
                popuplayertitle: 'право аренда',
                interactive: false,
                title: '<img src="styles/legend/_3.png" /> право аренда'
            });
var format__4 = new ol.format.GeoJSON();
var features__4 = format__4.readFeatures(json__4, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource__4 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource__4.addFeatures(features__4);
var lyr__4 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource__4, 
                style: style__4,
                popuplayertitle: 'право невитр.',
                interactive: false,
                title: '<img src="styles/legend/_4.png" /> право невитр.'
            });
var group_ = new ol.layer.Group({
                                layers: [lyr__1,lyr__2,lyr__3,lyr__4,],
                                fold: 'open',
                                title: 'Щ.А.'});

lyr_Google_0.setVisible(true);lyr__1.setVisible(true);lyr__2.setVisible(true);lyr__3.setVisible(true);lyr__4.setVisible(true);
var layersList = [lyr_Google_0,group_];
lyr__1.set('fieldAliases', {'FID': 'FID', });
lyr__2.set('fieldAliases', {'cadnum': 'cadnum', });
lyr__3.set('fieldAliases', {'cadnum': 'cadnum', });
lyr__4.set('fieldAliases', {'cadnum': 'cadnum', });
lyr__1.set('fieldImages', {'FID': '', });
lyr__2.set('fieldImages', {'cadnum': '', });
lyr__3.set('fieldImages', {'cadnum': '', });
lyr__4.set('fieldImages', {'cadnum': '', });
lyr__1.set('fieldLabels', {'FID': 'no label', });
lyr__2.set('fieldLabels', {'cadnum': 'no label', });
lyr__3.set('fieldLabels', {'cadnum': 'no label', });
lyr__4.set('fieldLabels', {'cadnum': 'no label', });
lyr__4.on('precompose', function(evt) {
    evt.context.globalCompositeOperation = 'normal';
});