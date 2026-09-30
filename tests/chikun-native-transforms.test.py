import importlib.util,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
try:
 spec=importlib.util.spec_from_file_location('native_transforms',ROOT/'scripts/lib/chikun_native_transforms.py');module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
except FileNotFoundError:module=None
class Object:
 def __init__(self,name='Body'):
  self.name=name;self.location=(0.0,0.1,0.44);self.rotation_mode='XYZ';self.rotation_euler=(0.0,0.7,0.0);self.rotation_quaternion=(1.0,0.0,0.0,0.0);self.rotation_axis_angle=(0.0,0.0,1.0,0.0);self.scale=(0.35,0.16,0.15);self.matrix_writes=0
 @property
 def matrix_world(self):return (self.location,self.rotation_euler,self.scale)
 @matrix_world.setter
 def matrix_world(self,value):self.matrix_writes+=1;self.scale=(self.scale[0]+1e-7,*self.scale[1:])
class Transforms(unittest.TestCase):
 def test_native_channels_restore_exactly_without_decomposing_matrix(self):
  obj=Object();before=vars(obj).copy();saved=module.capture_native_transforms([obj]);obj.matrix_world=obj.matrix_world;self.assertNotEqual(obj.scale,before['scale']);obj.location=(10,20,30);obj.rotation_euler=(1,2,3);module.restore_native_transforms([obj],saved)
  for key in ['location','rotation_mode','rotation_euler','rotation_quaternion','rotation_axis_angle','scale']:self.assertEqual(getattr(obj,key),before[key])
  self.assertEqual(obj.matrix_writes,1,'restoration must not write matrix_world')
 def test_capture_owns_immutable_original_channels(self):
  obj=Object();obj.location=[0.0,0.1,0.44];saved=module.capture_native_transforms([obj]);obj.location[0]=100;self.assertEqual(saved['Body']['location'][0],0.0)
  with self.assertRaises(TypeError):saved['Body']['location']=(1,2,3)
  with self.assertRaises(TypeError):saved['Body']={}
 def test_name_mismatch_or_duplicate_rejects_before_any_restore_write(self):
  original=Object();saved=module.capture_native_transforms([original]);other=Object('Other');other.location=(100,200,300)
  with self.assertRaises(ValueError):module.restore_native_transforms([other],saved)
  self.assertEqual(other.location,(100,200,300));self.assertEqual(other.matrix_writes,0)
  with self.assertRaises(ValueError):module.capture_native_transforms([original,Object()])
 def test_nonfinite_native_channels_reject_before_capture(self):
  obj=Object();obj.scale=(float('nan'),1,1)
  with self.assertRaises(ValueError):module.capture_native_transforms([obj])
if __name__=='__main__':unittest.main()
