"""Keep original native transform channels; matrix assignment decomposes them."""
import math
from types import MappingProxyType
CHANNELS={'location':3,'rotation_euler':3,'rotation_quaternion':4,'rotation_axis_angle':4,'scale':3}
def capture_native_transforms(objects):
 result={}
 for obj in objects:
  if obj.name in result:raise ValueError('Duplicate native object name')
  state={'rotation_mode':obj.rotation_mode}
  for name,length in CHANNELS.items():
   values=tuple(getattr(obj,name))
   if len(values)!=length or not all(math.isfinite(value)for value in values):raise ValueError('Invalid native transform channels')
   state[name]=values
  result[obj.name]=MappingProxyType(state)
 return MappingProxyType(result)
def restore_native_transforms(objects,saved):
 objects=list(objects);names=[obj.name for obj in objects]
 if len(names)!=len(set(names)) or set(names)!=set(saved):raise ValueError('Original native object ownership changed')
 for obj in objects:
  state=saved[obj.name];obj.rotation_mode=state['rotation_mode']
  for name in CHANNELS:setattr(obj,name,state[name])
