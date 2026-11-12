$ErrorActionPreference='Stop'
$projectRoot=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$scratch=Join-Path $projectRoot '_build\front-fix'
$doc=New-Object Xml.XmlDocument
$doc.PreserveWhitespace=$false
$doc.Load((Join-Path $scratch 'original.xml'))
$shared=$doc.SelectSingleNode('/root/shared')
$script:serial=1+($doc.SelectNodes('//*[@xs.id]') | ForEach-Object {[int]$_.GetAttribute('xs.id').Substring(1)} | Measure-Object -Maximum).Maximum
$script:index=1+($doc.SelectNodes('//*[@xs.idx]') | ForEach-Object {[int]$_.GetAttribute('xs.idx')} | Measure-Object -Maximum).Maximum
$culture=[Globalization.CultureInfo]::InvariantCulture
function Field($node,[string]$name){$node.SelectSingleNode('.//*[@xs.n="'+$name+'"]')}
function Ref($id){$doc.SelectSingleNode('//*[@xs.id="'+$id+'"]')}
function NumberList($node){,@($node.InnerText.Split(' ',[StringSplitOptions]::RemoveEmptyEntries) | ForEach-Object {[double]::Parse($_,$culture)})}
function SetNumbers($node,$values){$node.SetAttribute('count',[string]$values.Count);$node.InnerText=($values | ForEach-Object {$_.ToString('F6',$culture)}) -join ' '}
function Named([string]$type,[string]$name){$doc.SelectNodes('//'+$type+'[@xs.id]') | Where-Object {(Field $_ 'localName').InnerText -ceq $name}}
function NewShared($template){$copy=$template.CloneNode($true);$copy.SetAttribute('xs.id','#'+$script:serial++);$copy.SetAttribute('xs.idx',[string]$script:index++);if($copy.HasAttribute('uuid')){$copy.SetAttribute('uuid',[guid]::NewGuid().ToString())};$null=$shared.AppendChild($copy);return $copy}
function RestForm($source){
 $grid=Ref ((Field $source 'keyformGridSource').GetAttribute('xs.ref'))
 $wanted=@{}
 foreach($b in $grid.SelectNodes('./array_list[@xs.n="keyformBindings"]/KeyformBindingSource')){
  $binding=Ref $b.GetAttribute('xs.ref');$pg=(Field $binding 'parameterGuid').GetAttribute('xs.ref')
  $parameter=$doc.SelectNodes('//CParameterSource') | Where-Object {(Field $_ 'guid').GetAttribute('xs.ref') -eq $pg}
  $value=[double](Field $parameter 'defaultValue').InnerText;$keys=@((Field $binding 'keys').ChildNodes);$best=0;$difference=[double]::PositiveInfinity
  for($i=0;$i -lt $keys.Count;$i++){$d=[Math]::Abs([double]$keys[$i].InnerText-$value);if($d -lt $difference){$best=$i;$difference=$d}};$wanted[$binding.GetAttribute('xs.id')]=$best
 }
 $guid=$null
 foreach($f in $grid.SelectNodes('./array_list[@xs.n="keyformsOnGrid"]/KeyformOnGrid')){$match=$true;foreach($key in $f.SelectNodes('.//KeyOnParameter')){if([int](Field $key 'keyIndex').InnerText -ne $wanted[(Field $key 'binding').GetAttribute('xs.ref')]){$match=$false}};if($match){$guid=(Field $f 'keyformGuid').GetAttribute('xs.ref');break}}
 if(-not $guid){throw 'Missing neutral form'}
 return @($source.SelectNodes('./carray_list[@xs.n="keyforms"]/*') | Where-Object {(Field $_ 'guid').GetAttribute('xs.ref') -eq $guid})[0]
}
function Bounds($form){$v=NumberList (Field $form 'positions');$x=for($i=0;$i -lt $v.Count;$i+=2){$v[$i]};$y=for($i=1;$i -lt $v.Count;$i+=2){$v[$i]};return @([double]($x|Measure-Object -Minimum).Minimum,[double]($y|Measure-Object -Minimum).Minimum,[double]($x|Measure-Object -Maximum).Maximum,[double]($y|Measure-Object -Maximum).Maximum)}

# The neck and clothes must share the torso rotation. Convert coordinates
# through the neutral structural warp stack before reparenting the neck.
$outer=Bounds (RestForm (Named 'CWarpDeformerSource' 'Body Warp Z'))
$ox=$outer[0];$oy=$outer[1];$sx=$outer[2]-$ox;$sy=$outer[3]-$oy
foreach($name in @('Body Warp Y','Breath','Body X Warp')){$b=Bounds (RestForm (Named 'CWarpDeformerSource' $name));$ox+=$sx*$b[0];$oy+=$sy*$b[1];$sx*=($b[2]-$b[0]);$sy*=($b[3]-$b[1])}
$body=Named 'CRotationDeformerSource' 'body';$bodyGuid=(Field $body 'guid').GetAttribute('xs.ref')
$neck=Named 'CWarpDeformerSource' 'Neck Warp'
foreach($f in $neck.SelectNodes('./carray_list[@xs.n="keyforms"]/CWarpDeformerForm')){$n=Field $f 'positions';$v=NumberList $n;for($i=0;$i -lt $v.Count;$i+=2){$v[$i]=$ox+$sx*$v[$i]-512;$v[$i+1]=$oy+$sy*$v[$i+1]-800};SetNumbers $n $v}
(Field $neck 'targetDeformerGuid').SetAttribute('xs.ref',$bodyGuid)

# Fabric deformation keeps the neckline and waist contacts fixed.
foreach($name in @('dress_bodice Warp','dress_skirt Warp')){
 $warp=Named 'CWarpDeformerSource' $name;$rest=NumberList (Field (RestForm $warp) 'positions');$cols=1+[int](Field $warp 'col').InnerText;$rows=[int](Field $warp 'row').InnerText
 foreach($f in $warp.SelectNodes('./carray_list[@xs.n="keyforms"]/CWarpDeformerForm')){$node=Field $f 'positions';$v=NumberList $node;for($i=0;$i -lt $v.Count;$i+=2){$t=[Math]::Floor(($i/2)/$cols)/$rows;$w=if($name -eq 'dress_bodice Warp'){.22*[Math]::Pow([Math]::Sin([Math]::PI*$t),2)}else{.6*[Math]::Max(0,($t-.2)/.8)};$v[$i]=$rest[$i]+($v[$i]-$rest[$i])*$w;$v[$i+1]=$rest[$i+1]+($v[$i+1]-$rest[$i+1])*$w};SetNumbers $node $v}
}

# Add independent wrist controls and a denser shoulder/elbow/wrist mesh grid.
$params=$doc.SelectSingleNode('//CParameterSourceSet/carray_list[@xs.n="_sources"]')
foreach($side in @('left','right')){
 $suffix=if($side -eq 'left'){'L'}else{'R'};$mesh=Named 'CArtMeshSource' ('arm_'+$side);$grid=Ref ((Field $mesh 'keyformGridSource').GetAttribute('xs.ref'))
 $elbowBinding=Ref ($grid.SelectSingleNode('./array_list[@xs.n="keyformBindings"]/KeyformBindingSource').GetAttribute('xs.ref'))
 $parameter=$doc.SelectNodes('//CParameterSource') | Where-Object {(Field $_ 'id').GetAttribute('idstr') -eq ('ParamRotation_'+$side+'Elbow')}
 $newParameter=$parameter.CloneNode($true);$pg=NewShared (Ref ((Field $parameter 'guid').GetAttribute('xs.ref')));$pg.SetAttribute('note','ParamWrist'+$suffix)
 (Field $newParameter 'guid').SetAttribute('xs.ref',$pg.GetAttribute('xs.id'));(Field $newParameter 'id').SetAttribute('idstr','ParamWrist'+$suffix)
 (Field $newParameter 'name').InnerText='Wrist '+$suffix;(Field $newParameter 'minValue').InnerText='-18.0';(Field $newParameter 'maxValue').InnerText='18.0';(Field $newParameter 'defaultValue').InnerText='0.0';$null=$params.AppendChild($newParameter)
 $wristBinding=NewShared $elbowBinding;(Field $wristBinding 'parameterGuid').SetAttribute('xs.ref',$pg.GetAttribute('xs.id'));(Field $wristBinding 'description').InnerText='ParamWrist'+$suffix
 $wristKeys=Field $wristBinding 'keys';$templateKey=$wristKeys.FirstChild.CloneNode($true);$wristKeys.RemoveAll();$wristKeys.SetAttribute('xs.n','keys');$wristKeys.SetAttribute('count','3');foreach($k in @(-18,0,18)){$f=$templateKey.CloneNode($true);$f.InnerText=[string]$k;$null=$wristKeys.AppendChild($f)}
 $angles=@(-90,-67.5,-45,-22.5,0,22.5,45,67.5,90);$keys=Field $elbowBinding 'keys';$keys.RemoveAll();$keys.SetAttribute('xs.n','keys');$keys.SetAttribute('count','9');foreach($a in $angles){$f=$templateKey.CloneNode($true);$f.InnerText=$a.ToString($culture);$null=$keys.AppendChild($f)}
 $bindings=Field $grid 'keyformBindings';$ref=$bindings.FirstChild.CloneNode($true);$ref.SetAttribute('xs.ref',$wristBinding.GetAttribute('xs.id'));$null=$bindings.AppendChild($ref);$bindings.SetAttribute('count','2')
 $kfs=Field $grid 'keyformsOnGrid';$keyTemplate=$kfs.FirstChild.CloneNode($true);$kfs.RemoveAll();$kfs.SetAttribute('xs.n','keyformsOnGrid');$kfs.SetAttribute('count','27')
 $forms=$mesh.SelectSingleNode('./carray_list[@xs.n="keyforms"]');$formTemplate=$forms.FirstChild.CloneNode($true);$formGuid=Ref ((Field $formTemplate 'guid').GetAttribute('xs.ref'));$forms.RemoveAll();$forms.SetAttribute('xs.n','keyforms');$forms.SetAttribute('count','27')
 $base=NumberList ($mesh.SelectSingleNode('./float-array[@xs.n="positions"]'))
 if($side -eq 'left'){$shoulder=@(415,650);$elbow=@(319,757);$wrist=@(252,823);$hand=@(196,871)}else{$shoulder=@(624,650);$elbow=@(710,757);$wrist=@(788,829);$hand=@(840,875)}
 $fx=$wrist[0]-$elbow[0];$fy=$wrist[1]-$elbow[1];$length=$fx*$fx+$fy*$fy;$hx=$hand[0]-$wrist[0];$hy=$hand[1]-$wrist[1];$handLength=$hx*$hx+$hy*$hy
 # Cubism binding[0] is the fastest grid axis (elbow before wrist).
 for($wi=0;$wi -lt 3;$wi++){for($ei=0;$ei -lt 9;$ei++){
  $a=$angles[$ei]*[Math]::PI/180;$wa=@(-18,0,18)[$wi]*[Math]::PI/180;$values=New-Object 'System.Collections.Generic.List[double]'
  $wx=$elbow[0]+$fx*[Math]::Cos($a)-$fy*[Math]::Sin($a);$wy=$elbow[1]+$fx*[Math]::Sin($a)+$fy*[Math]::Cos($a)
  for($i=0;$i -lt $base.Count;$i+=2){$x=$base[$i];$y=$base[$i+1];$t=[Math]::Max(0,[Math]::Min(1,((($x-$elbow[0])*$fx+($y-$elbow[1])*$fy)/$length+.18)/.96));$weight=$t*$t*(3-2*$t)
   $angle=$a*$weight;$rx=$x-$elbow[0];$ry=$y-$elbow[1];$px=$elbow[0]+$rx*[Math]::Cos($angle)-$ry*[Math]::Sin($angle);$py=$elbow[1]+$rx*[Math]::Sin($angle)+$ry*[Math]::Cos($angle)
   $t=[Math]::Max(0,[Math]::Min(1,(($x-$wrist[0])*$hx+($y-$wrist[1])*$hy)/$handLength));$angle=$wa*$t*$t*(3-2*$t);$rx=$px-$wx;$ry=$py-$wy
   $values.Add($wx+$rx*[Math]::Cos($angle)-$ry*[Math]::Sin($angle)-$shoulder[0]);$values.Add($wy+$rx*[Math]::Sin($angle)+$ry*[Math]::Cos($angle)-$shoulder[1])
  }
  $guid=NewShared $formGuid;$guid.SetAttribute('note','arm_'+$side+'_elbow_'+$ei+'_wrist_'+$wi);$form=$formTemplate.CloneNode($true);(Field $form 'guid').SetAttribute('xs.ref',$guid.GetAttribute('xs.id'));SetNumbers (Field $form 'positions') $values;$null=$forms.AppendChild($form)
  $kf=$keyTemplate.CloneNode($true);(Field $kf 'keyformGuid').SetAttribute('xs.ref',$guid.GetAttribute('xs.id'));$keyList=Field $kf '_keyOnParameterList';$key=$keyList.FirstChild.CloneNode($true);$keyList.RemoveAll();$keyList.SetAttribute('xs.n','_keyOnParameterList');$keyList.SetAttribute('count','2')
  foreach($pair in @(@($elbowBinding.GetAttribute('xs.id'),$ei),@($wristBinding.GetAttribute('xs.id'),$wi))){$k=$key.CloneNode($true);(Field $k 'binding').SetAttribute('xs.ref',$pair[0]);(Field $k 'keyIndex').InnerText=[string]$pair[1];$null=$keyList.AppendChild($k)};$null=$kfs.AppendChild($kf)
 }}
}
$params.SetAttribute('count',[string]$params.ChildNodes.Count)

# Merge the writer-authored back lining resource graph with unique native IDs.
$lining=New-Object Xml.XmlDocument;$lining.Load((Join-Path $scratch 'lining.xml'));$map=@{}
foreach($node in $lining.SelectNodes('//*[@xs.id]')){$old=$node.GetAttribute('xs.id');$map[$old]='#'+$script:serial++;$node.SetAttribute('xs.id',$map[$old]);$node.SetAttribute('xs.idx',[string]$script:index++);if($node.HasAttribute('uuid') -and $node.Name -ne 'StaticFilterDefGuid'){$node.SetAttribute('uuid',[guid]::NewGuid().ToString())}}
foreach($node in $lining.SelectNodes('//*[@xs.ref]')){$node.SetAttribute('xs.ref',$map[$node.GetAttribute('xs.ref')])}
# The one-form mesh is constant. Its writer-only opacity parameter is not part
# of the front model; bind its single zero key to an existing parameter.
$constantParameter=$doc.SelectNodes('//CParameterSource')|Where-Object {(Field $_ 'id').GetAttribute('idstr') -eq 'ParamBreath'}
foreach($binding in $lining.SelectNodes('//KeyformBindingSource[@xs.id]')){(Field $binding 'parameterGuid').SetAttribute('xs.ref',(Field $constantParameter 'guid').GetAttribute('xs.ref'));(Field $binding 'description').InnerText='ParamBreath'}
foreach($node in $lining.SelectNodes('//file[@path]')){$node.SetAttribute('path','repair_back_'+$node.GetAttribute('path').Replace('/','_'))}
$backMesh=$lining.SelectSingleNode('//CArtMeshSource[@xs.id]');$skirt=Named 'CArtMeshSource' 'dress_skirt'
(Field $backMesh 'parentGuid').SetAttribute('xs.ref',(Field $skirt 'parentGuid').GetAttribute('xs.ref'));(Field $backMesh 'targetDeformerGuid').SetAttribute('xs.ref',(Field $skirt 'targetDeformerGuid').GetAttribute('xs.ref'))
(Field $backMesh 'id').SetAttribute('idstr','ArtMesh33');(Field $backMesh 'drawOrder').InnerText='55'
$backForm=$backMesh.SelectSingleNode('./carray_list[@xs.n="keyforms"]/CArtMeshForm');(Field $backForm 'positions').InnerText=(Field (RestForm $skirt) 'positions').InnerText;(Field $backForm 'coordType').SetAttribute('xs.ref',(Field (RestForm $skirt) 'coordType').GetAttribute('xs.ref'))
foreach($node in @($lining.SelectSingleNode('/root/shared').ChildNodes)){$null=$shared.AppendChild($doc.ImportNode($node,$true))}
$drawables=$doc.SelectSingleNode('//CDrawableSourceSet/carray_list[@xs.n="_sources"]');$ref=$doc.CreateElement('CArtMeshSource');$ref.SetAttribute('xs.ref',$backMesh.GetAttribute('xs.id'));$null=$drawables.AppendChild($ref);$drawables.SetAttribute('count',[string]$drawables.ChildNodes.Count)
$parentPart=$doc.SelectNodes('//CPartSource[@xs.id]')|Where-Object {(Field $_ 'guid').GetAttribute('xs.ref') -eq (Field $backMesh 'parentGuid').GetAttribute('xs.ref')}
$children=Field $parentPart '_childGuids';$child=$doc.CreateElement('CDrawableGuid');$child.SetAttribute('xs.ref',$backMesh.SelectSingleNode('.//CDrawableGuid[@xs.n="guid"]').GetAttribute('xs.ref'));$null=$children.AppendChild($child);$children.SetAttribute('count',[string]$children.ChildNodes.Count)
$textureManager=$doc.SelectSingleNode('//CTextureManager');$groups=Field $textureManager '_modelImageGroups';$group=$lining.SelectSingleNode('//CModelImageGroup[@xs.id]');$ref=$doc.CreateElement('CModelImageGroup');$ref.SetAttribute('xs.ref',$group.GetAttribute('xs.id'));$null=$groups.AppendChild($ref);$groups.SetAttribute('count',[string]$groups.ChildNodes.Count)
$raw=Field $textureManager '_rawImages';foreach($wrapper in $lining.SelectNodes('//CTextureManager/carray_list[@xs.n="_rawImages"]/LayeredImageWrapper')){$null=$raw.AppendChild($doc.ImportNode($wrapper,$true))};$raw.SetAttribute('count',[string]$raw.ChildNodes.Count)

$resourceMap=@{}
foreach($name in @('dress_bodice','dress_skirt','arm_left','arm_right')){
 $image=$doc.SelectNodes('//CModelImage') | Where-Object {(Field $_ 'name').InnerText -ceq $name}
 $resourceIds=@((Field $image '_filteredImage').GetAttribute('xs.ref'))
 $layer=Ref ($image.SelectSingleNode('.//CLayer[@xs.n="layer"]').GetAttribute('xs.ref'));$resourceIds+=((Field $layer 'imageResource').GetAttribute('xs.ref'))
 $sourceFile=Join-Path $projectRoot ('live2d/source/front-repair/'+$name+'.png')
 foreach($id in ($resourceIds | Select-Object -Unique)){$resource=Ref $id;$entry=$resource.SelectSingleNode('./file[@xs.n="imageFileBuf"]').GetAttribute('path');$resource.SetAttribute('imageFileBuf_size',[string](Get-Item -LiteralPath $sourceFile).Length);$resourceMap[$entry]=$sourceFile}
}
$resourceMap | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $scratch 'resources.json') -Encoding utf8
$doc.Save((Join-Path $scratch 'repaired.xml'))
$doc.Save((Join-Path $scratch 'base-repaired.xml'))
Write-Output 'Authored shared neck/torso anchors, pinned fabric contacts, wrist/elbow grids and independent back lining'
