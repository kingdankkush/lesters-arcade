1|// Canonical hand-made art manifest for lilly (sprite-pipeline schema).
2|// Source: Justin's Art Assets. Generation tools only ADD frames, never redesign.
3|export const HMH_CANON_LILLY = Object.freeze({
4|  "id": "lilly",
5|  "role": "hero",
6|  "frameSize": [
7|    112,
8|    96
9|  ],
10|  "anchor": "bottom-center",
11|  "directions": [
12|    "east",
13|    "south-east",
14|    "south",
15|    "south-west",
16|    "west",
17|    "north-west",
18|    "north",
19|    "north-east"
20|  ],
21|  "defaultDirection": "south",
22|  "targetFps": 60,
23|  "source": "Justin canonical hand-made art (background-removed, cropped, rescaled)",
24|  "look": "teal hair, glasses",
25|  "stateAliases": {
26|    "shoot": "attack",
27|    "melee": "attack"
28|  },
29|  "states": {
30|    "idle": {
31|      "fps": 6,
32|      "loop": true,
33|      "frames": {
34|        "south": [
35|          "./assets/generated/hmh-canonical-art/lilly/idle/idle-00.png",
36|          "./assets/generated/hmh-canonical-art/lilly/idle/idle-01.png",
37|          "./assets/generated/hmh-canonical-art/lilly/idle/idle-02.png",
38|          "./assets/generated/hmh-canonical-art/lilly/idle/idle-03.png",
39|          "./assets/generated/hmh-canonical-art/lilly/idle/idle-04.png",
40|          "./assets/generated/hmh-canonical-art/lilly/idle/idle-05.png",
41|          "./assets/generated/hmh-canonical-art/lilly/idle/idle-06.png",
42|          "./assets/generated/hmh-canonical-art/lilly/idle/idle-07.png"
43|        ],
44|        "south-east": [
45|          "./assets/generated/hmh-canonical-art/lilly/idle/idle-00-flipped-southeast.png"
46|        ],
47|        "south-west": [
48|          "./assets/generated/hmh-canonical-art/lilly/idle/idle-00-flipped-southwest.png"
49|        ],
50|        "north-east": [
51|          "./assets/generated/hmh-canonical-art/lilly/idle/idle-00-flipped-northeast.png"
52|        ],
53|        "north-west": [
54|          "./assets/generated/hmh-canonical-art/lilly/idle/idle-00-flipped-northwest.png"
55|        ],
56|        "west": [
57|          "./assets/generated/hmh-canonical-art/lilly/idle/idle-00-flipped-west.png"
58|        ],
59|        "east": [
60|          "./assets/generated/hmh-canonical-art/lilly/idle/idle-00-flipped-east.png"
61|        ],
62|        "north": [
63|          "./assets/generated/hmh-canonical-art/lilly/idle/idle-00-flipped-north.png"
64|        ]
65|      }
66|    },
67|    "walk": {
68|      "fps": 10,
69|      "loop": true,
70|      "frames": {
71|        "south": [
72|          "./assets/generated/hmh-canonical-art/lilly/walk/walk-00.png",
73|          "./assets/generated/hmh-canonical-art/lilly/walk/walk-01.png",
74|          "./assets/generated/hmh-canonical-art/lilly/walk/walk-02.png",
75|          "./assets/generated/hmh-canonical-art/lilly/walk/walk-03.png",
76|          "./assets/generated/hmh-canonical-art/lilly/walk/walk-04.png",
77|          "./assets/generated/hmh-canonical-art/lilly/walk/walk-05.png",
78|          "./assets/generated/hmh-canonical-art/lilly/walk/walk-06.png",
79|          "./assets/generated/hmh-canonical-art/lilly/walk/walk-07.png",
80|          "./assets/generated/hmh-canonical-art/lilly/walk/walk-08.png",
81|          "./assets/generated/hmh-canonical-art/lilly/walk/walk-09.png",
82|          "./assets/generated/hmh-canonical-art/lilly/walk/walk-10.png",
83|          "./assets/generated/hmh-canonical-art/lilly/walk/walk-11.png",
84|          "./assets/generated/hmh-canonical-art/lilly/walk/walk-12.png",
85|          "./assets/generated/hmh-canonical-art/lilly/walk/walk-13.png",
86|          "./assets/generated/hmh-canonical-art/lilly/walk/walk-14.png",
87|          "./assets/generated/hmh-canonical-art/lilly/walk/walk-15.png",
88|          "./assets/generated/hmh-canonical-art/lilly/walk/walk-16.png",
89|          "./assets/generated/hmh-canonical-art/lilly/walk/walk-17.png",
90|          "./assets/generated/hmh-canonical-art/lilly/walk/walk-18.png",
91|          "./assets/generated/hmh-canonical-art/lilly/walk/walk-19.png"
92|        ],
93|        "south-east": [
94|          "./assets/generated/hmh-canonical-art/lilly/walk/walk-00-flipped-southeast.png"
95|        ],
96|        "south-west": [
97|          "./assets/generated/hmh-canonical-art/lilly/walk/walk-00-flipped-southwest.png"
98|        ],
99|        "north-east": [
100|          "./assets/generated/hmh-canonical-art/lilly/walk/walk-00-flipped-northeast.png"
101|        ],
102|        "north-west": [
103|          "./assets/generated/hmh-canonical-art/lilly/walk/walk-00-flipped-northwest.png"
104|        ],
105|        "west": [
106|          "./assets/generated/hmh-canonical-art/lilly/walk/walk-00-flipped-west.png"
107|        ],
108|        "east": [
109|          "./assets/generated/hmh-canonical-art/lilly/walk/walk-00-flipped-east.png"
110|        ],
111|        "north": [
112|          "./assets/generated/hmh-canonical-art/lilly/walk/walk-00-flipped-north.png"
113|        ]
114|      }
115|    },
116|    "run": {
117|      "fps": 14,
118|      "loop": true,
119|      "frames": {
120|        "south": [
121|          "./assets/generated/hmh-canonical-art/lilly/run/run-00.png",
122|          "./assets/generated/hmh-canonical-art/lilly/run/run-01.png",
123|          "./assets/generated/hmh-canonical-art/lilly/run/run-02.png",
124|          "./assets/generated/hmh-canonical-art/lilly/run/run-03.png",
125|          "./assets/generated/hmh-canonical-art/lilly/run/run-04.png",
126|          "./assets/generated/hmh-canonical-art/lilly/run/run-05.png",
127|          "./assets/generated/hmh-canonical-art/lilly/run/run-06.png",
128|          "./assets/generated/hmh-canonical-art/lilly/run/run-07.png",
129|          "./assets/generated/hmh-canonical-art/lilly/run/run-08.png",
130|          "./assets/generated/hmh-canonical-art/lilly/run/run-09.png",
131|          "./assets/generated/hmh-canonical-art/lilly/run/run-10.png",
132|          "./assets/generated/hmh-canonical-art/lilly/run/run-11.png",
133|          "./assets/generated/hmh-canonical-art/lilly/run/run-12.png",
134|          "./assets/generated/hmh-canonical-art/lilly/run/run-13.png",
135|          "./assets/generated/hmh-canonical-art/lilly/run/run-14.png",
136|          "./assets/generated/hmh-canonical-art/lilly/run/run-15.png",
137|          "./assets/generated/hmh-canonical-art/lilly/run/run-16.png",
138|          "./assets/generated/hmh-canonical-art/lilly/run/run-17.png",
139|          "./assets/generated/hmh-canonical-art/lilly/run/run-18.png",
140|          "./assets/generated/hmh-canonical-art/lilly/run/run-19.png",
141|          "./assets/generated/hmh-canonical-art/lilly/run/run-20.png",
142|          "./assets/generated/hmh-canonical-art/lilly/run/run-21.png",
143|          "./assets/generated/hmh-canonical-art/lilly/run/run-22.png",
144|          "./assets/generated/hmh-canonical-art/lilly/run/run-23.png",
145|          "./assets/generated/hmh-canonical-art/lilly/run/run-24.png",
146|          "./assets/generated/hmh-canonical-art/lilly/run/run-25.png",
147|          "./assets/generated/hmh-canonical-art/lilly/run/run-26.png",
148|          "./assets/generated/hmh-canonical-art/lilly/run/run-27.png",
149|          "./assets/generated/hmh-canonical-art/lilly/run/run-28.png",
150|          "./assets/generated/hmh-canonical-art/lilly/run/run-29.png"
151|        ],
152|        "south-east": [
153|          "./assets/generated/hmh-canonical-art/lilly/run/run-00-flipped-southeast.png"
154|        ],
155|        "south-west": [
156|          "./assets/generated/hmh-canonical-art/lilly/run/run-00-flipped-southwest.png"
157|        ],
158|        "north-east": [
159|          "./assets/generated/hmh-canonical-art/lilly/run/run-00-flipped-northeast.png"
160|        ],
161|        "north-west": [
162|          "./assets/generated/hmh-canonical-art/lilly/run/run-00-flipped-northwest.png"
163|        ],
164|        "west": [
165|          "./assets/generated/hmh-canonical-art/lilly/run/run-00-flipped-west.png"
166|        ],
167|        "east": [
168|          "./assets/generated/hmh-canonical-art/lilly/run/run-00-flipped-east.png"
169|        ],
170|        "north": [
171|          "./assets/generated/hmh-canonical-art/lilly/run/run-00-flipped-north.png"
172|        ]
173|      }
174|    },
175|    "jump": {
176|      "fps": 10,
177|      "loop": false,
178|      "frames": {
179|        "south": [
180|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-00.png",
181|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-01.png",
182|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-02.png",
183|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-03.png",
184|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-04.png",
185|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-05.png",
186|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-06.png",
187|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-07.png",
188|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-08.png",
189|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-09.png",
190|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-10.png",
191|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-11.png",
192|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-12.png",
193|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-13.png",
194|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-14.png",
195|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-15.png",
196|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-16.png",
197|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-17.png",
198|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-18.png",
199|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-19.png",
200|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-20.png",
201|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-21.png",
202|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-22.png",
203|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-23.png",
204|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-24.png",
205|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-25.png",
206|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-26.png",
207|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-27.png",
208|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-28.png"
209|        ],
210|        "south-east": [
211|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-00-flipped-southeast.png"
212|        ],
213|        "south-west": [
214|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-00-flipped-southwest.png"
215|        ],
216|        "north-east": [
217|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-00-flipped-northeast.png"
218|        ],
219|        "north-west": [
220|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-00-flipped-northwest.png"
221|        ],
222|        "west": [
223|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-00-flipped-west.png"
224|        ],
225|        "east": [
226|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-00-flipped-east.png"
227|        ],
228|        "north": [
229|          "./assets/generated/hmh-canonical-art/lilly/jump/jump-00-flipped-north.png"
230|        ]
231|      }
232|    },
233|    "attack": {
234|      "fps": 14,
235|      "loop": false,
236|      "frames": {
237|        "south": [
238|          "./assets/generated/hmh-canonical-art/lilly/attack/attack-00.png",
239|          "./assets/generated/hmh-canonical-art/lilly/attack/attack-01.png",
240|          "./assets/generated/hmh-canonical-art/lilly/attack/attack-02.png",
241|          "./assets/generated/hmh-canonical-art/lilly/attack/attack-03.png",
242|          "./assets/generated/hmh-canonical-art/lilly/attack/attack-04.png",
243|          "./assets/generated/hmh-canonical-art/lilly/attack/attack-05.png",
244|          "./assets/generated/hmh-canonical-art/lilly/attack/attack-06.png",
245|          "./assets/generated/hmh-canonical-art/lilly/attack/attack-07.png",
246|          "./assets/generated/hmh-canonical-art/lilly/attack/attack-08.png",
247|          "./assets/generated/hmh-canonical-art/lilly/attack/attack-09.png",
248|          "./assets/generated/hmh-canonical-art/lilly/attack/attack-10.png",
249|          "./assets/generated/hmh-canonical-art/lilly/attack/attack-11.png"
250|        ],
251|        "south-east": [
252|          "./assets/generated/hmh-canonical-art/lilly/attack/attack-00-flipped-southeast.png"
253|        ],
254|        "south-west": [
255|          "./assets/generated/hmh-canonical-art/lilly/attack/attack-00-flipped-southwest.png"
256|        ],
257|        "north-east": [
258|          "./assets/generated/hmh-canonical-art/lilly/attack/attack-00-flipped-northeast.png"
259|        ],
260|        "north-west": [
261|          "./assets/generated/hmh-canonical-art/lilly/attack/attack-00-flipped-northwest.png"
262|        ],
263|        "west": [
264|          "./assets/generated/hmh-canonical-art/lilly/attack/attack-00-flipped-west.png"
265|        ],
266|        "east": [
267|          "./assets/generated/hmh-canonical-art/lilly/attack/attack-00-flipped-east.png"
268|        ],
269|        "north": [
270|          "./assets/generated/hmh-canonical-art/lilly/attack/attack-00-flipped-north.png"
271|        ]
272|      }
273|    }
274|  }
275|});
276|