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
                popuplayertitle: 'АФП вне контура',
                interactive: true,
                title: '<img src="styles/legend/_1.png" /> АФП вне контура'
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
                popuplayertitle: 'АФП в контуре',
                interactive: true,
                title: '<img src="styles/legend/_2.png" /> АФП в контуре'
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
                popuplayertitle: 'ТОВ вне контура',
                interactive: true,
                title: '<img src="styles/legend/_3.png" /> ТОВ вне контура'
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
                popuplayertitle: 'ТОВ в контуре',
                interactive: true,
                title: '<img src="styles/legend/_4.png" /> ТОВ в контуре'
            });
var format__5 = new ol.format.GeoJSON();
var features__5 = format__5.readFeatures(json__5, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource__5 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource__5.addFeatures(features__5);
var lyr__5 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource__5, 
                style: style__5,
                popuplayertitle: 'птахофабрика вне контура',
                interactive: true,
                title: '<img src="styles/legend/_5.png" /> птахофабрика вне контура'
            });
var format__6 = new ol.format.GeoJSON();
var features__6 = format__6.readFeatures(json__6, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource__6 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource__6.addFeatures(features__6);
var lyr__6 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource__6, 
                style: style__6,
                popuplayertitle: 'птахофабрика в контуре',
                interactive: true,
                title: '<img src="styles/legend/_6.png" /> птахофабрика в контуре'
            });
var format__7 = new ol.format.GeoJSON();
var features__7 = format__7.readFeatures(json__7, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource__7 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource__7.addFeatures(features__7);
var lyr__7 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource__7, 
                style: style__7,
                popuplayertitle: 'дороги вне контура',
                interactive: true,
                title: '<img src="styles/legend/_7.png" /> дороги вне контура'
            });
var format__8 = new ol.format.GeoJSON();
var features__8 = format__8.readFeatures(json__8, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource__8 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource__8.addFeatures(features__8);
var lyr__8 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource__8, 
                style: style__8,
                popuplayertitle: 'дороги в контуре',
                interactive: true,
                title: '<img src="styles/legend/_8.png" /> дороги в контуре'
            });
var format__9 = new ol.format.GeoJSON();
var features__9 = format__9.readFeatures(json__9, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource__9 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource__9.addFeatures(features__9);
var lyr__9 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource__9, 
                style: style__9,
                popuplayertitle: '⭐поля в план однотонно',
                interactive: false,
                title: '<img src="styles/legend/_9.png" /> ⭐поля в план однотонно'
            });
var format__10 = new ol.format.GeoJSON();
var features__10 = format__10.readFeatures(json__10, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:3857'});
var jsonSource__10 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource__10.addFeatures(features__10);
var lyr__10 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource__10, 
                style: style__10,
                popuplayertitle: 'точки интереса',
                interactive: true,
                title: '<img src="styles/legend/_10.png" /> точки интереса'
            });
var group_ = new ol.layer.Group({
                                layers: [],
                                fold: 'open',
                                title: 'виртуальные слои'});
var group_ = new ol.layer.Group({
                                layers: [lyr_Google_0,lyr__1,lyr__2,lyr__3,lyr__4,lyr__5,lyr__6,lyr__7,lyr__8,lyr__9,lyr__10,],
                                fold: 'open',
                                title: 'нов'});

lyr_Google_0.setVisible(true);lyr__1.setVisible(true);lyr__2.setVisible(true);lyr__3.setVisible(true);lyr__4.setVisible(true);lyr__5.setVisible(true);lyr__6.setVisible(true);lyr__7.setVisible(true);lyr__8.setVisible(true);lyr__9.setVisible(true);lyr__10.setVisible(true);
var layersList = [group_];
lyr__1.set('fieldAliases', {'fid': 'fid', 'id': 'id', 'cadnum': 'cadnum', 'area_ok': 'area_ok', });
lyr__2.set('fieldAliases', {'fid': 'fid', 'id': 'id', 'cadnum': 'cadnum', 'area_ok': 'area_ok', });
lyr__3.set('fieldAliases', {'fid': 'fid', 'id': 'id', 'cadnum': 'cadnum', 'area_ok': 'area_ok', });
lyr__4.set('fieldAliases', {'fid': 'fid', 'id': 'id', 'cadnum': 'cadnum', 'area_ok': 'area_ok', });
lyr__5.set('fieldAliases', {'fid': 'fid', 'id': 'id', 'cadnum': 'cadnum', 'area_ok': 'area_ok', });
lyr__6.set('fieldAliases', {'fid': 'fid', 'id': 'id', 'cadnum': 'cadnum', 'area_ok': 'area_ok', });
lyr__7.set('fieldAliases', {'fid': 'fid', 'id': 'id', 'cadnum': 'cadnum', 'area_ok': 'area_ok', });
lyr__8.set('fieldAliases', {'fid': 'fid', 'id': 'id', 'cadnum': 'cadnum', 'area_ok': 'area_ok', });
lyr__9.set('fieldAliases', {'fid': 'fid', 'id': 'id', 'history_it': 'history_it', 'folder': 'folder', 'grp': 'grp', 'f_name': 'f_name', 'alert': 'алерт', 'f_name2': 'f_name2', 'zembank ok': 'zembank ok', 'alert2': 'alert2', 'сев26': 'сев26', });
lyr__10.set('fieldAliases', {'fid': 'fid', 'id': 'id', 'имя': 'имя', });
lyr__1.set('fieldImages', {'fid': 'TextEdit', 'id': 'TextEdit', 'cadnum': 'TextEdit', 'area_ok': 'TextEdit', });
lyr__2.set('fieldImages', {'fid': 'TextEdit', 'id': 'TextEdit', 'cadnum': 'TextEdit', 'area_ok': 'Range', });
lyr__3.set('fieldImages', {'fid': 'TextEdit', 'id': 'TextEdit', 'cadnum': 'TextEdit', 'area_ok': 'TextEdit', });
lyr__4.set('fieldImages', {'fid': 'TextEdit', 'id': 'TextEdit', 'cadnum': 'TextEdit', 'area_ok': 'Range', });
lyr__5.set('fieldImages', {'fid': 'TextEdit', 'id': 'TextEdit', 'cadnum': 'TextEdit', 'area_ok': 'Range', });
lyr__6.set('fieldImages', {'fid': 'TextEdit', 'id': 'TextEdit', 'cadnum': 'TextEdit', 'area_ok': 'Range', });
lyr__7.set('fieldImages', {'fid': 'TextEdit', 'id': 'TextEdit', 'cadnum': 'TextEdit', 'area_ok': 'TextEdit', });
lyr__8.set('fieldImages', {'fid': 'TextEdit', 'id': 'TextEdit', 'cadnum': 'TextEdit', 'area_ok': 'TextEdit', });
lyr__9.set('fieldImages', {'fid': 'TextEdit', 'id': 'TextEdit', 'history_it': 'Range', 'folder': 'TextEdit', 'grp': '', 'f_name': 'TextEdit', 'alert': 'TextEdit', 'f_name2': 'TextEdit', 'zembank ok': 'ValueMap', 'alert2': 'TextEdit', 'сев26': '', });
lyr__10.set('fieldImages', {'fid': '', 'id': '', 'имя': '', });
lyr__1.set('fieldLabels', {'fid': 'hidden field', 'id': 'hidden field', 'cadnum': 'inline label - visible with data', 'area_ok': 'inline label - visible with data', });
lyr__2.set('fieldLabels', {'fid': 'no label', 'id': 'no label', 'cadnum': 'inline label - visible with data', 'area_ok': 'inline label - visible with data', });
lyr__3.set('fieldLabels', {'fid': 'hidden field', 'id': 'hidden field', 'cadnum': 'inline label - visible with data', 'area_ok': 'inline label - visible with data', });
lyr__4.set('fieldLabels', {'fid': 'hidden field', 'id': 'hidden field', 'cadnum': 'inline label - visible with data', 'area_ok': 'inline label - visible with data', });
lyr__5.set('fieldLabels', {'fid': 'hidden field', 'id': 'hidden field', 'cadnum': 'inline label - visible with data', 'area_ok': 'inline label - visible with data', });
lyr__6.set('fieldLabels', {'fid': 'hidden field', 'id': 'hidden field', 'cadnum': 'inline label - visible with data', 'area_ok': 'inline label - visible with data', });
lyr__7.set('fieldLabels', {'fid': 'hidden field', 'id': 'hidden field', 'cadnum': 'inline label - visible with data', 'area_ok': 'inline label - visible with data', });
lyr__8.set('fieldLabels', {'fid': 'hidden field', 'id': 'hidden field', 'cadnum': 'inline label - visible with data', 'area_ok': 'inline label - visible with data', });
lyr__9.set('fieldLabels', {'fid': 'no label', 'id': 'no label', 'history_it': 'no label', 'folder': 'no label', 'grp': 'no label', 'f_name': 'no label', 'alert': 'no label', 'f_name2': 'no label', 'zembank ok': 'no label', 'alert2': 'no label', 'сев26': 'no label', });
lyr__10.set('fieldLabels', {'fid': 'hidden field', 'id': 'hidden field', 'имя': 'inline label - visible with data', });
lyr__10.on('precompose', function(evt) {
    evt.context.globalCompositeOperation = 'normal';
});