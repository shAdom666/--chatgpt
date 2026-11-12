$ErrorActionPreference='Stop'
$projectRoot=(Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..\..')).Path
$scratch=Join-Path $projectRoot '_build\posture-fix'
$grids=Get-Content -LiteralPath (Join-Path $scratch 'deformation-grids.json') -Raw | ConvertFrom-Json
$culture=[Globalization.CultureInfo]::InvariantCulture
function Field($node,[string]$name){$node.SelectSingleNode('.//*[@xs.n="'+$name+'"]')}
function Ref($id){$doc.SelectSingleNode('//*[@xs.id="'+$id+'"]')}
function InitDoc([string]$file){$script:doc=New-Object Xml.XmlDocument;$doc.Load($file);$script:shared=$doc.SelectSingleNode('/root/shared');$script:serial=1+($doc.SelectNodes('//*[@xs.id]')|ForEach-Object {[int]$_.GetAttribute('xs.id').Substring(1)}|Measure-Object -Maximum).Maximum;$script:index=1+($doc.SelectNodes('//*[@xs.idx]')|ForEach-Object {[int]$_.GetAttribute('xs.idx')}|Measure-Object -Maximum).Maximum}
function NewShared($template){$copy=$template.CloneNode($true);$copy.SetAttribute('xs.id','#'+$script:serial++);$copy.SetAttribute('xs.idx',[string]$script:index++);if($copy.HasAttribute('uuid')){$copy.SetAttribute('uuid',[guid]::NewGuid().ToString())};$null=$shared.AppendChild($copy);return $copy}
function Numbers($node){,@($node.InnerText.Split(' ',[StringSplitOptions]::RemoveEmptyEntries)|ForEach-Object {[double]::Parse($_,$culture)})}
function SetNumbers($node,$values){$node.SetAttribute('count',[string]$values.Count);$node.InnerText=($values|ForEach-Object {([double]$_).ToString('F6',$culture)}) -join ' '}
function Named([string]$type,[string]$name){$doc.SelectNodes('//'+$type+'[@xs.id]')|Where-Object {(Field $_ 'localName').InnerText -ceq $name}}
function AddParameter([string]$id,[double]$min,[double]$max,[double]$default){$parameter=$doc.SelectNodes('//CParameterSource')|Select-Object -First 1;$copy=$parameter.CloneNode($true);$guid=NewShared (Ref ((Field $parameter 'guid').GetAttribute('xs.ref')));$guid.SetAttribute('note',$id);(Field $copy 'guid').SetAttribute('xs.ref',$guid.GetAttribute('xs.id'));$idNode=Field $copy 'id';$idNode.RemoveAttribute('xs.ref');$idNode.RemoveAttribute('xs.id');$idNode.SetAttribute('idstr',$id);(Field $copy 'name').InnerText=$id;(Field $copy 'minValue').InnerText=$min.ToString($culture);(Field $copy 'maxValue').InnerText=$max.ToString($culture);(Field $copy 'defaultValue').InnerText=$default.ToString($culture);$sources=$doc.SelectSingleNode('//CParameterSourceSet/carray_list[@xs.n="_sources"]');$null=$sources.AppendChild($copy);$sources.SetAttribute('count',[string]$sources.ChildNodes.Count);return $guid.GetAttribute('xs.id')}
function SetKeys($binding,$values){$keys=Field $binding 'keys';$template=$keys.FirstChild.CloneNode($true);$keys.RemoveAll();$keys.SetAttribute('xs.n','keys');$keys.SetAttribute('count',[string]$values.Count);foreach($v in $values){$key=$template.CloneNode($true);$key.InnerText=([double]$v).ToString($culture);$null=$keys.AppendChild($key)}}

# Pose meshes retain breathing and gain an independent transition deformation.
InitDoc (Join-Path $scratch 'original.xml')
$transition=AddParameter 'ParamTransition' -1 1 0
foreach($warp in @($doc.SelectNodes('//CWarpDeformerSource[@xs.id]'))){
 $name=(Field $warp 'localName').InnerText -replace ' Warp$','';$shapes=$grids.$name;if(-not $shapes){throw ('No deformation data '+$name)}
 $grid=Ref ((Field $warp 'keyformGridSource').GetAttribute('xs.ref'));$binding=Ref ($grid.SelectSingleNode('./array_list[@xs.n="keyformBindings"]/KeyformBindingSource').GetAttribute('xs.ref'))
 $newBinding=NewShared $binding;(Field $newBinding 'parameterGuid').SetAttribute('xs.ref',$transition);(Field $newBinding 'description').InnerText='ParamTransition';SetKeys $newBinding @(-1,0,1)
 $bindings=Field $grid 'keyformBindings';$ref=$bindings.FirstChild.CloneNode($true);$ref.SetAttribute('xs.ref',$newBinding.GetAttribute('xs.id'));$null=$bindings.AppendChild($ref);$bindings.SetAttribute('count','2')
 $keyforms=Field $grid 'keyformsOnGrid';$kfTemplate=$keyforms.FirstChild.CloneNode($true);$keyforms.RemoveAll();$keyforms.SetAttribute('xs.n','keyformsOnGrid');$keyforms.SetAttribute('count','9')
 $forms=$warp.SelectSingleNode('./carray_list[@xs.n="keyforms"]');$template=$forms.FirstChild.CloneNode($true);$guidTemplate=Ref ((Field $template 'guid').GetAttribute('xs.ref'));$forms.RemoveAll();$forms.SetAttribute('xs.n','keyforms');$forms.SetAttribute('count','9')
 # Cubism binding[0] is the fastest grid axis (breath before transition).
 for($ti=0;$ti -lt 3;$ti++){for($bi=0;$bi -lt 3;$bi++){
  $guid=NewShared $guidTemplate;$form=$template.CloneNode($true);(Field $form 'guid').SetAttribute('xs.ref',$guid.GetAttribute('xs.id'));SetNumbers (Field $form 'positions') $shapes[$bi][$ti];$null=$forms.AppendChild($form)
  $kf=$kfTemplate.CloneNode($true);(Field $kf 'keyformGuid').SetAttribute('xs.ref',$guid.GetAttribute('xs.id'));$list=Field $kf '_keyOnParameterList';$key=$list.FirstChild.CloneNode($true);$list.RemoveAll();$list.SetAttribute('xs.n','_keyOnParameterList');$list.SetAttribute('count','2')
  foreach($pair in @(@($binding.GetAttribute('xs.id'),$bi),@($newBinding.GetAttribute('xs.id'),$ti))){$k=$key.CloneNode($true);(Field $k 'binding').SetAttribute('xs.ref',$pair[0]);(Field $k 'keyIndex').InnerText=[string]$pair[1];$null=$list.AppendChild($k)};$null=$keyforms.AppendChild($kf)
 }}
}
$doc.Save((Join-Path $scratch 'repaired.xml'))

# The standing native model prepares to crouch with the same midpoint shape.
InitDoc (Join-Path $projectRoot '_build\front-fix\base-repaired.xml')
$prepare=AddParameter 'ParamCrouchPrepare' 0 1 0
$body=Named 'CWarpDeformerSource' 'Body Warp Z';$oldId=$body.GetAttribute('xs.id');$macro=NewShared $body;$macroId=$macro.GetAttribute('xs.id');$macroGuid=NewShared (Ref ((Field $body 'guid').GetAttribute('xs.ref')))
$macroGuid.SetAttribute('note','Posture prepare');(Field $macro 'guid').SetAttribute('xs.ref',$macroGuid.GetAttribute('xs.id'));(Field $macro 'localName').InnerText='Posture prepare';(Field $macro 'id').SetAttribute('idstr','Warp_PosturePrepare');(Field $macro 'col').InnerText=[string]$grids.front.col;(Field $macro 'row').InnerText=[string]$grids.front.row
foreach($node in $macro.SelectNodes('.//*[@xs.ref="'+$oldId+'"]')){$node.SetAttribute('xs.ref',$macroId)}
$grid=NewShared (Ref ((Field $body 'keyformGridSource').GetAttribute('xs.ref')));$oldBinding=Ref ($grid.SelectSingleNode('./array_list[@xs.n="keyformBindings"]/KeyformBindingSource').GetAttribute('xs.ref'));$binding=NewShared $oldBinding
(Field $binding '_gridSource').SetAttribute('xs.ref',$grid.GetAttribute('xs.id'));(Field $binding 'parameterGuid').SetAttribute('xs.ref',$prepare);(Field $binding 'description').InnerText='ParamCrouchPrepare';SetKeys $binding @(0,.5,1)
foreach($node in $grid.SelectNodes('.//KeyformBindingSource')){$node.SetAttribute('xs.ref',$binding.GetAttribute('xs.id'))};(Field $macro 'keyformGridSource').SetAttribute('xs.ref',$grid.GetAttribute('xs.id'))
$forms=@($macro.SelectNodes('./carray_list[@xs.n="keyforms"]/CWarpDeformerForm'));$formKeys=@($grid.SelectNodes('./array_list[@xs.n="keyformsOnGrid"]/KeyformOnGrid'))
for($i=0;$i -lt 3;$i++){$guid=NewShared (Ref ((Field $forms[$i] 'guid').GetAttribute('xs.ref')));(Field $forms[$i] 'guid').SetAttribute('xs.ref',$guid.GetAttribute('xs.id'));(Field $formKeys[$i] 'keyformGuid').SetAttribute('xs.ref',$guid.GetAttribute('xs.id'));$values=for($k=0;$k -lt $grids.front.base.Count;$k++){[double]$grids.front.base[$k]+([double]$grids.front.prepared[$k]-[double]$grids.front.base[$k])*$i/2};SetNumbers (Field $forms[$i] 'positions') $values}
$bounds=$grids.front.bounds;$width=$bounds[2]-$bounds[0];$height=$bounds[3]-$bounds[1]
(Field $body 'targetDeformerGuid').SetAttribute('xs.ref',$macroGuid.GetAttribute('xs.id'))
foreach($f in $body.SelectNodes('./carray_list[@xs.n="keyforms"]/CWarpDeformerForm')){$n=Field $f 'positions';$values=Numbers $n;for($i=0;$i -lt $values.Count;$i+=2){$values[$i]=($values[$i]-$bounds[0])/$width;$values[$i+1]=($values[$i+1]-$bounds[1])/$height};SetNumbers $n $values;(Field $f 'coordType').SetAttribute('xs.ref','#373')}
# Keep feet on the root ground plane. A rotation under the lowering macro
# translates its entire leg instead of keeping the sole at y=1400.
$sources=$doc.SelectSingleNode('//CDeformerSourceSet/carray_list[@xs.n="_sources"]');$ref=$doc.CreateElement('CWarpDeformerSource');$ref.SetAttribute('xs.ref',$macroId);$null=$sources.AppendChild($ref);$sources.SetAttribute('count',[string]$sources.ChildNodes.Count)
$parentPart=$doc.SelectNodes('//CPartSource[@xs.id]')|Where-Object {(Field $_ 'guid').GetAttribute('xs.ref') -eq (Field $macro 'parentGuid').GetAttribute('xs.ref')}
$children=Field $parentPart '_childGuids';$child=$doc.CreateElement('CDeformerGuid');$child.SetAttribute('xs.ref',$macroGuid.GetAttribute('xs.id'));$null=$children.AppendChild($child);$children.SetAttribute('count',[string]$children.ChildNodes.Count)
$doc.Save((Join-Path $projectRoot '_build\front-fix\repaired.xml'))
Write-Output 'Authored exclusive pose handoff warps and a matching standing preparation warp'
