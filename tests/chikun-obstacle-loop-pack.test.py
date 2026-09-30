"""Pure/native-free validation of registered Chikun obstacle loop tiers."""
import importlib.util
from pathlib import Path
import tempfile
import unittest
from PIL import Image,ImageDraw
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('loop_pack',ROOT/'scripts/lib/chikun_obstacle_loop_pack.py')
pack=importlib.util.module_from_spec(spec);spec.loader.exec_module(pack)
class LoopPackTests(unittest.TestCase):
 def frames(self,directory):
  files=[]
  for index in range(8):
   image=Image.new('RGBA',(512,256));draw=ImageDraw.Draw(image);draw.rectangle((224,120,288,160),fill=(255,0,0,255));draw.rectangle((110,50+index*8,190,70+index*8),fill=(0,0,255,255));file=directory/f'{index:02}.png';image.save(file);files.append(file)
  return files
 def test_fixed_common_crop_registers_body_in_all_eight_frames_at_all_tiers(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);files=self.frames(root);result=pack.pack_obstacle_loop(files,root/'packed','eagle')
   self.assertEqual(result['frames'],8)
   for tier,width in [('low',128),('medium',192),('high',256)]:
    info=result['tiers'][tier];self.assertEqual(info['decodedBytes'],width*4*width*4)
    with Image.open(root/'packed'/info['file']) as sheet:
     self.assertEqual(sheet.size,(width*4,width));centres=[]
     for frame in range(8):
      cell=sheet.crop(((frame%4)*width,(frame//4)*width//2,(frame%4+1)*width,(frame//4+1)*width//2));pixels=cell.load();red=[(x,y)for y in range(cell.height)for x in range(cell.width)if pixels[x,y][0]>200 and pixels[x,y][1]<40 and pixels[x,y][2]<40 and pixels[x,y][3]>200]
      centres.append((sum(x for x,y in red)/len(red),sum(y for x,y in red)/len(red)))
      self.assertIsNone(cell.crop((0,0,cell.width,1)).getbbox());self.assertIsNone(cell.crop((0,0,1,cell.height)).getbbox())
     self.assertEqual(len(set(centres)),1,'common camera registration keeps the body still while wings move')
 def test_missing_empty_mismatched_or_clipped_frames_reject_before_output(self):
  for problem in ['count','empty','size','clipped']:
   with tempfile.TemporaryDirectory() as directory:
    root=Path(directory);files=self.frames(root)
    if problem=='count':files.pop()
    elif problem=='empty':Image.new('RGBA',(512,256)).save(files[0])
    elif problem=='size':Image.new('RGBA',(256,256)).save(files[0])
    else:
     image=Image.open(files[0]);ImageDraw.Draw(image).rectangle((0,0,40,40),fill='white');image.save(files[0])
    with self.assertRaises(ValueError):pack.pack_obstacle_loop(files,root/'packed','eagle')
    self.assertFalse((root/'packed').exists())
 def test_existing_output_or_unknown_actor_is_never_overwritten(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory);files=self.frames(root);out=root/'packed';out.mkdir();(out/'preserved.txt').write_text('original')
   with self.assertRaises(ValueError):pack.pack_obstacle_loop(files,out,'eagle')
   self.assertEqual((out/'preserved.txt').read_text(),'original')
   with self.assertRaises(ValueError):pack.pack_obstacle_loop(files,root/'other','unknown')
if __name__=='__main__':unittest.main()
