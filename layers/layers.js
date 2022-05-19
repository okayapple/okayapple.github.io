var wms_layers = [];


        var lyr_GoogleSatelliteHybrid_0 = new ol.layer.Tile({
            'title': 'Google Satellite Hybrid',
            'type': 'base',
            'opacity': 1.000000,
            
            
            source: new ol.source.XYZ({
    attributions: ' ',
                url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
            })
        });

        var lyr_kdasstr_1 = new ol.layer.Tile({
            'title': 'kdasstr',
            'type': 'base',
            'opacity': 1.000000,
            
            
            source: new ol.source.XYZ({
    attributions: ' ',
                url: 'http://gisfile.com/api/cadmap/{z}/{x}/{y}.png'
            })
        });
var format__2 = new ol.format.GeoJSON();
var features__2 = format__2.readFeatures(json__2, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource__2 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource__2.addFeatures(features__2);
var lyr__2 = new ol.layer.Vector({
                declutter: true,
                source:jsonSource__2, 
                style: style__2,
                interactive: false,
                title: '<img src="styles/legend/_2.png" /> поля'
            });
var format__3 = new ol.format.GeoJSON();
var features__3 = format__3.readFeatures(json__3, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource__3 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource__3.addFeatures(features__3);
var lyr__3 = new ol.layer.Vector({
                declutter: true,
                source:jsonSource__3, 
                style: style__3,
                interactive: false,
                title: '<img src="styles/legend/_3.png" />  поля вильнянка'
            });
var format_29040105_4 = new ol.format.GeoJSON();
var features_29040105_4 = format_29040105_4.readFeatures(json_29040105_4, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_29040105_4 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_29040105_4.addFeatures(features_29040105_4);
var lyr_29040105_4 = new ol.layer.Vector({
                declutter: true,
                source:jsonSource_29040105_4, 
                style: style_29040105_4,
                interactive: false,
                title: '<img src="styles/legend/29040105_4.png" /> 29.04-01.05'
            });
var format_01050805_5 = new ol.format.GeoJSON();
var features_01050805_5 = format_01050805_5.readFeatures(json_01050805_5, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource_01050805_5 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_01050805_5.addFeatures(features_01050805_5);
var lyr_01050805_5 = new ol.layer.Vector({
                declutter: true,
                source:jsonSource_01050805_5, 
                style: style_01050805_5,
                interactive: false,
                title: '<img src="styles/legend/01050805_5.png" /> 01.05-08.05'
            });

lyr_GoogleSatelliteHybrid_0.setVisible(true);lyr_kdasstr_1.setVisible(true);lyr__2.setVisible(true);lyr__3.setVisible(true);lyr_29040105_4.setVisible(true);lyr_01050805_5.setVisible(true);
var layersList = [lyr_GoogleSatelliteHybrid_0,lyr_kdasstr_1,lyr__2,lyr__3,lyr_29040105_4,lyr_01050805_5];
lyr__2.set('fieldAliases', {'Name': 'Name', 'layer': 'layer', 'path': 'path', });
lyr__3.set('fieldAliases', {'Name': 'Name', 'layer': 'layer', 'path': 'path', });
lyr_29040105_4.set('fieldAliases', {'name': 'name', 'cmt': 'cmt', 'desc': 'desc', 'src': 'src', 'link1_href': 'link1_href', 'link1_text': 'link1_text', 'link1_type': 'link1_type', 'link2_href': 'link2_href', 'link2_text': 'link2_text', 'link2_type': 'link2_type', 'number': 'number', 'type': 'type', });
lyr_01050805_5.set('fieldAliases', {'name': 'name', 'cmt': 'cmt', 'desc': 'desc', 'src': 'src', 'link1_href': 'link1_href', 'link1_text': 'link1_text', 'link1_type': 'link1_type', 'link2_href': 'link2_href', 'link2_text': 'link2_text', 'link2_type': 'link2_type', 'number': 'number', 'type': 'type', });
lyr__2.set('fieldImages', {'Name': '', 'layer': '', 'path': '', });
lyr__3.set('fieldImages', {'Name': '', 'layer': '', 'path': '', });
lyr_29040105_4.set('fieldImages', {'name': '', 'cmt': '', 'desc': '', 'src': '', 'link1_href': '', 'link1_text': '', 'link1_type': '', 'link2_href': '', 'link2_text': '', 'link2_type': '', 'number': '', 'type': '', });
lyr_01050805_5.set('fieldImages', {'name': '', 'cmt': '', 'desc': '', 'src': '', 'link1_href': '', 'link1_text': '', 'link1_type': '', 'link2_href': '', 'link2_text': '', 'link2_type': '', 'number': '', 'type': '', });
lyr__2.set('fieldLabels', {'Name': 'no label', 'layer': 'no label', 'path': 'no label', });
lyr__3.set('fieldLabels', {'Name': 'no label', 'layer': 'no label', 'path': 'no label', });
lyr_29040105_4.set('fieldLabels', {'name': 'no label', 'cmt': 'no label', 'desc': 'no label', 'src': 'no label', 'link1_href': 'no label', 'link1_text': 'no label', 'link1_type': 'no label', 'link2_href': 'no label', 'link2_text': 'no label', 'link2_type': 'no label', 'number': 'no label', 'type': 'no label', });
lyr_01050805_5.set('fieldLabels', {'name': 'no label', 'cmt': 'no label', 'desc': 'no label', 'src': 'no label', 'link1_href': 'no label', 'link1_text': 'no label', 'link1_type': 'no label', 'link2_href': 'no label', 'link2_text': 'no label', 'link2_type': 'no label', 'number': 'no label', 'type': 'no label', });
lyr_01050805_5.on('precompose', function(evt) {
    evt.context.globalCompositeOperation = 'normal';
});