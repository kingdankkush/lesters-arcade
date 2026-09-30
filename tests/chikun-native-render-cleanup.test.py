import ast,json,unittest
from pathlib import Path
from types import SimpleNamespace
ROOT=Path(__file__).resolve().parents[1]
tree=ast.parse((ROOT/'scripts/chikun-blender/render-chikun-eagle-loop.py').read_text(encoding='utf-8'))
finally_body=next(node.finalbody for node in tree.body if isinstance(node,ast.Try) and node.finalbody)
code=compile(ast.fix_missing_locations(ast.Module(body=finally_body,type_ignores=[])),'actual-native-producer-finally','exec')
class Writer:
 def __init__(self):self.saved=None
 def __truediv__(self,name):return self
 def write_bytes(self,data):self.saved=json.loads(data)
class Cleanup(unittest.TestCase):
 def fixture(self,restore=lambda *args:None):
  output=Writer();record={'completed':True,'failure':'primary-failure','frames':[]}
  return output,record,{'record':record,'objects':[object()],'native_transforms':None,'restore_native_transforms':restore,'bpy':SimpleNamespace(context=SimpleNamespace(view_layer=SimpleNamespace(update=lambda:None))),'identity':lambda objects:'after','sha':lambda file:'original','SOURCE':'source','EXPECTED':'original','OUT':output,'json':json}
 def test_missing_before_capture_keeps_primary_failure_and_persists_receipt(self):
  output,record,env=self.fixture();exec(code,env);self.assertIsNotNone(output.saved);self.assertEqual(output.saved['failure'],'primary-failure');self.assertFalse(output.saved['completed']);self.assertFalse(output.saved['restored']);self.assertEqual(output.saved['sourceSha256After'],'original')
 def test_native_restore_failure_cannot_mask_primary_or_skip_receipt(self):
  def restore(*args):raise RuntimeError('native-restore-failed')
  output,record,env=self.fixture(restore);record['meshIdentityBefore']='after';env['native_transforms']={};exec(code,env);self.assertIsNotNone(output.saved);self.assertEqual(output.saved['failure'],'primary-failure');self.assertIn('native-restore-failed',output.saved['restorationFailure']);self.assertFalse(output.saved['completed']);self.assertFalse(output.saved['restored'])
if __name__=='__main__':unittest.main()
