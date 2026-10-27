"""Build Oregon and Idaho agency rows for the source registry.

Writes data/agencies/or.json and data/agencies/id.json in the `sources` row shape
(see supabase/migrations and data/README.md). build_seed.py merges them.

Inputs (not vendored; fetch with `npm pack cities.json us-atlas@3.0.1` and untar):
  --cities   cities.json/package/cities.json   (GeoNames, pop >= 1000, has county FIPS)
  --counties us-atlas/package/counties-10m.json (Census county shapes, for centroids)

City lists are the incorporated cities from Wikipedia ("List of cities in Oregon/Idaho").
School district and special district lists are hand-curated and need verification;
those rows carry discovered_via='manual' and status='missing' until a procurement page
is confirmed.

Usage: python scripts/build_or_id_agencies.py --cities PATH --counties PATH
"""

import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "data" / "agencies"

STATE_FIPS = {"OR": "41", "ID": "16"}

# Incorporated cities with their (primary) county, from Wikipedia.
OR_CITIES = """Adair Village (Benton), Adams (Umatilla), Adrian (Malheur), Albany (Linn), Amity (Yamhill), Antelope (Wasco), Arlington (Gilliam), Ashland (Jackson), Astoria (Clatsop), Athena (Umatilla), Aumsville (Marion), Aurora (Marion), Baker City (Baker), Bandon (Coos), Banks (Washington), Barlow (Clackamas), Bay City (Tillamook), Beaverton (Washington), Bend (Deschutes), Boardman (Morrow), Bonanza (Klamath), Brookings (Curry), Brownsville (Linn), Burns (Harney), Butte Falls (Jackson), Canby (Clackamas), Cannon Beach (Clatsop), Canyon City (Grant), Canyonville (Douglas), Carlton (Yamhill), Cascade Locks (Hood River), Cave Junction (Josephine), Central Point (Jackson), Chiloquin (Klamath), Clatskanie (Columbia), Coburg (Lane), Columbia City (Columbia), Condon (Gilliam), Coos Bay (Coos), Coquille (Coos), Cornelius (Washington), Corvallis (Benton), Cottage Grove (Lane), Cove (Union), Creswell (Lane), Culver (Jefferson), Dallas (Polk), Dayton (Yamhill), Dayville (Grant), Depoe Bay (Lincoln), Detroit (Marion), Donald (Marion), Drain (Douglas), Dufur (Wasco), Dundee (Yamhill), Dunes City (Lane), Durham (Washington), Eagle Point (Jackson), Echo (Umatilla), Elgin (Union), Elkton (Douglas), Enterprise (Wallowa), Estacada (Clackamas), Eugene (Lane), Fairview (Multnomah), Falls City (Polk), Florence (Lane), Forest Grove (Washington), Fossil (Wheeler), Garibaldi (Tillamook), Gaston (Washington), Gates (Marion), Gearhart (Clatsop), Gervais (Marion), Gladstone (Clackamas), Glendale (Douglas), Gold Beach (Curry), Gold Hill (Jackson), Granite (Grant), Grants Pass (Josephine), Grass Valley (Sherman), Greenhorn (Baker), Gresham (Multnomah), Haines (Baker), Halfway (Baker), Halsey (Linn), Happy Valley (Clackamas), Harrisburg (Linn), Helix (Umatilla), Heppner (Morrow), Hermiston (Umatilla), Hillsboro (Washington), Hines (Harney), Hood River (Hood River), Hubbard (Marion), Huntington (Baker), Idanha (Marion), Imbler (Union), Independence (Polk), Ione (Morrow), Irrigon (Morrow), Island City (Union), Jacksonville (Jackson), Jefferson (Marion), John Day (Grant), Johnson City (Clackamas), Jordan Valley (Malheur), Joseph (Wallowa), Junction City (Lane), Keizer (Marion), King City (Washington), Klamath Falls (Klamath), La Grande (Union), La Pine (Deschutes), Lafayette (Yamhill), Lake Oswego (Clackamas), Lakeside (Coos), Lakeview (Lake), Lebanon (Linn), Lexington (Morrow), Lincoln City (Lincoln), Lonerock (Gilliam), Long Creek (Grant), Lostine (Wallowa), Lowell (Lane), Lyons (Linn), Madras (Jefferson), Malin (Klamath), Manzanita (Tillamook), Maupin (Wasco), Maywood Park (Multnomah), McMinnville (Yamhill), Medford (Jackson), Merrill (Klamath), Metolius (Jefferson), Mill City (Linn), Millersburg (Linn), Milton-Freewater (Umatilla), Milwaukie (Clackamas), Mitchell (Wheeler), Molalla (Clackamas), Monmouth (Polk), Monroe (Benton), Monument (Grant), Moro (Sherman), Mosier (Wasco), Mount Vernon (Grant), Mt. Angel (Marion), Myrtle Creek (Douglas), Myrtle Point (Coos), Nehalem (Tillamook), Newberg (Yamhill), Newport (Lincoln), North Bend (Coos), North Plains (Washington), North Powder (Union), Nyssa (Malheur), Oakland (Douglas), Oakridge (Lane), Ontario (Malheur), Oregon City (Clackamas), Paisley (Lake), Pendleton (Umatilla), Philomath (Benton), Phoenix (Jackson), Pilot Rock (Umatilla), Port Orford (Curry), Portland (Multnomah), Powers (Coos), Prairie City (Grant), Prescott (Columbia), Prineville (Crook), Rainier (Columbia), Redmond (Deschutes), Reedsport (Douglas), Richland (Baker), Riddle (Douglas), Rivergrove (Clackamas), Rockaway Beach (Tillamook), Rogue River (Jackson), Roseburg (Douglas), Rufus (Sherman), Salem (Marion), Sandy (Clackamas), Scappoose (Columbia), Scio (Linn), Scotts Mills (Marion), Seaside (Clatsop), Seneca (Grant), Shady Cove (Jackson), Shaniko (Wasco), Sheridan (Yamhill), Sherwood (Washington), Siletz (Lincoln), Silverton (Marion), Sisters (Deschutes), Sodaville (Linn), Spray (Wheeler), Springfield (Lane), St. Helens (Columbia), St. Paul (Marion), Stanfield (Umatilla), Stayton (Marion), Sublimity (Marion), Summerville (Union), Sumpter (Baker), Sutherlin (Douglas), Sweet Home (Linn), Talent (Jackson), Tangent (Linn), The Dalles (Wasco), Tigard (Washington), Tillamook (Tillamook), Toledo (Lincoln), Troutdale (Multnomah), Tualatin (Washington), Turner (Marion), Ukiah (Umatilla), Umatilla (Umatilla), Union (Union), Unity (Baker), Vale (Malheur), Veneta (Lane), Vernonia (Columbia), Waldport (Lincoln), Wallowa (Wallowa), Warrenton (Clatsop), Wasco (Sherman), Waterloo (Linn), West Linn (Clackamas), Westfir (Lane), Weston (Umatilla), Wheeler (Tillamook), Willamina (Yamhill), Wilsonville (Clackamas), Winston (Douglas), Wood Village (Multnomah), Woodburn (Marion), Yachats (Lincoln), Yamhill (Yamhill), Yoncalla (Douglas)"""

ID_CITIES = """Boise (Ada), Meridian (Ada), Nampa (Canyon), Idaho Falls (Bonneville), Caldwell (Canyon), Pocatello (Bannock), Coeur d'Alene (Kootenai), Twin Falls (Twin Falls), Rexburg (Madison), Post Falls (Kootenai), Lewiston (Nez Perce), Eagle (Ada), Moscow (Latah), Kuna (Ada), Ammon (Bonneville), Mountain Home (Elmore), Chubbuck (Bannock), Hayden (Kootenai), Jerome (Jerome), Blackfoot (Bingham), Garden City (Ada), Burley (Cassia), Star (Ada), Middleton (Canyon), Rathdrum (Kootenai), Hailey (Blaine), Sandpoint (Bonner), Payette (Payette), Emmett (Gem), Rupert (Minidoka), Fruitland (Payette), Weiser (Washington), Preston (Franklin), Rigby (Jefferson), Shelley (Bingham), Kimberly (Twin Falls), American Falls (Power), Buhl (Twin Falls), Gooding (Gooding), Heyburn (Minidoka), McCall (Valley), St. Anthony (Fremont), Ketchum (Blaine), Grangeville (Idaho), Orofino (Clearwater), Soda Springs (Caribou), Salmon (Lemhi), Wendell (Gooding), Homedale (Owyhee), Filer (Twin Falls), Iona (Bonneville), Montpelier (Bear Lake), Bellevue (Blaine), Dalton Gardens (Kootenai), Bonners Ferry (Boundary), St. Maries (Benewah), Spirit Lake (Kootenai), Kellogg (Shoshone), Malad City (Oneida), Victor (Teton), Parma (Canyon), Driggs (Teton), Sun Valley (Blaine), Aberdeen (Bingham), Sugar City (Madison), Priest River (Bonner), Pinehurst (Shoshone), Shoshone (Lincoln), Wilder (Canyon), Osburn (Shoshone), New Plymouth (Payette), Ponderay (Bonner), Glenns Ferry (Elmore), Marsing (Owyhee), Paul (Minidoka), Lapwai (Nez Perce), Ucon (Bonneville), Kamiah (Lewis), Hansen (Twin Falls), Genesee (Latah), Franklin (Franklin), Plummer (Benewah), Cascade (Valley), Hagerman (Gooding), Ashton (Fremont), Kootenai (Bonner), Grace (Caribou), Challis (Custer), Troy (Latah), Arco (Butte), Council (Adams), McCammon (Bannock), Cottonwood (Idaho), Moyie Springs (Boundary), Greenleaf (Canyon), Hazelton (Jerome), Inkom (Bannock), Wallace (Shoshone), Teton (Fremont), Oakley (Cassia), Potlatch (Latah), Hauser (Kootenai), Dover (Bonner), Horseshoe Bend (Boise), Menan (Jefferson), Athol (Kootenai), Carey (Blaine), Smelterville (Shoshone), Ririe (Jefferson), Hayden Lake (Kootenai), Mullan (Shoshone), Juliaetta (Latah), Notus (Canyon), Melba (Canyon), Downey (Bannock), Paris (Bear Lake), Firth (Bingham), New Meadows (Adams), Kooskia (Idaho), Clark Fork (Bonner), Dubois (Clark), Weston (Franklin), Dayton (Franklin), Deary (Latah), Georgetown (Bear Lake), Roberts (Jefferson), Pierce (Clearwater), Idaho City (Boise), Craigmont (Lewis), Nezperce (Lewis), Fairfield (Camas), Grand View (Owyhee), Mackay (Custer), Richfield (Lincoln), Lewisville (Jefferson), Clifton (Franklin), Culdesac (Nez Perce), Weippe (Clearwater), Eden (Jerome), Riggins (Idaho), Lava Hot Springs (Bannock), Basalt (Bingham), Winchester (Lewis), Arimo (Bannock), Declo (Cassia), Newdale (Fremont), Cambridge (Washington), Mud Lake (Jefferson), Tetonia (Teton), Parker (Fremont), Bancroft (Caribou), Kendrick (Latah), Dietrich (Lincoln), Irwin (Bonneville), Bliss (Gooding), Worley (Kootenai), Donnelly (Valley), Hollister (Twin Falls), Rockland (Power), Albion (Cassia), Harrison (Kootenai), East Hope (Bonner), Swan Valley (Bonneville), Oldtown (Bonner), Castleford (Twin Falls), Bloomington (Bear Lake), Onaway (Latah), Island Park (Fremont), Midvale (Washington), Wardner (Shoshone), Bovill (Latah), Stites (Idaho), Malta (Cassia), Peck (Nez Perce), Fernan Lake Village (Kootenai), Moore (Butte), St. Charles (Bear Lake), Crouch (Boise), Elk River (Clearwater), Ferdinand (Idaho), Acequia (Minidoka), Stanley (Custer), Murtaugh (Twin Falls), Huetter (Kootenai), Hope (Bonner), Leadore (Lemhi), Minidoka (Minidoka), Tensed (Benewah), White Bird (Idaho), Butte City (Butte), Placerville (Boise), Reubens (Lewis), Lost River (Custer), Oxford (Franklin), State Line (Kootenai), Spencer (Clark), Drummond (Fremont), Clayton (Custer), Warm River (Fremont)"""

# School districts: (name, city where the district office is, county). Hand-curated.
OR_SCHOOLS = """Portland Public Schools|Portland|Multnomah; Salem-Keizer School District|Salem|Marion; Beaverton School District|Beaverton|Washington; Hillsboro School District|Hillsboro|Washington; Bend-La Pine Schools|Bend|Deschutes; Eugene School District 4J|Eugene|Lane; North Clackamas School District|Milwaukie|Clackamas; Medford School District|Medford|Jackson; Tigard-Tualatin School District|Tigard|Washington; David Douglas School District|Portland|Multnomah; Reynolds School District|Fairview|Multnomah; Gresham-Barlow School District|Gresham|Multnomah; Springfield Public Schools|Springfield|Lane; Centennial School District|Portland|Multnomah; Lake Oswego School District|Lake Oswego|Clackamas; West Linn-Wilsonville School District|West Linn|Clackamas; Oregon City School District|Oregon City|Clackamas; Greater Albany Public Schools|Albany|Linn; Corvallis School District|Corvallis|Benton; Redmond School District|Redmond|Deschutes; Sherwood School District|Sherwood|Washington; Grants Pass School District|Grants Pass|Josephine; Three Rivers School District|Grants Pass|Josephine; Forest Grove School District|Forest Grove|Washington; Canby School District|Canby|Clackamas; Newberg School District|Newberg|Yamhill; McMinnville School District|McMinnville|Yamhill; Woodburn School District|Woodburn|Marion; Bethel School District|Eugene|Lane; Roseburg Public Schools|Roseburg|Douglas; Klamath County School District|Klamath Falls|Klamath; Klamath Falls City Schools|Klamath Falls|Klamath; Hermiston School District|Hermiston|Umatilla; Pendleton School District|Pendleton|Umatilla; Lincoln County School District|Newport|Lincoln; Central Point School District|Central Point|Jackson; Eagle Point School District|Eagle Point|Jackson; Ashland School District|Ashland|Jackson; Phoenix-Talent School District|Phoenix|Jackson; Dallas School District|Dallas|Polk; Central School District 13J|Independence|Polk; Lebanon Community Schools|Lebanon|Linn; Sweet Home School District|Sweet Home|Linn; South Lane School District|Cottage Grove|Lane; Crook County School District|Prineville|Crook; Jefferson County School District 509J|Madras|Jefferson; Silver Falls School District|Silverton|Marion; North Santiam School District|Stayton|Marion; Cascade School District|Turner|Marion; Parkrose School District|Portland|Multnomah; Riverdale School District|Portland|Multnomah; Gladstone School District|Gladstone|Clackamas; Oregon Trail School District|Sandy|Clackamas; Estacada School District|Estacada|Clackamas; Molalla River School District|Molalla|Clackamas; Colton School District|Colton|Clackamas; Corbett School District|Corbett|Multnomah; St. Helens School District|St. Helens|Columbia; Scappoose School District|Scappoose|Columbia; Rainier School District|Rainier|Columbia; Clatskanie School District|Clatskanie|Columbia; Vernonia School District|Vernonia|Columbia; Astoria School District|Astoria|Clatsop; Seaside School District|Seaside|Clatsop; Warrenton-Hammond School District|Warrenton|Clatsop; Knappa School District|Astoria|Clatsop; Jewell School District|Seaside|Clatsop; Tillamook School District|Tillamook|Tillamook; Neah-Kah-Nie School District|Rockaway Beach|Tillamook; Nestucca Valley School District|Hebo|Tillamook; Coos Bay School District|Coos Bay|Coos; North Bend School District|North Bend|Coos; Coquille School District|Coquille|Coos; Bandon School District|Bandon|Coos; Myrtle Point School District|Myrtle Point|Coos; Powers School District|Powers|Coos; Brookings-Harbor School District|Brookings|Curry; Central Curry School District|Gold Beach|Curry; Port Orford-Langlois School District|Port Orford|Curry; Sutherlin School District|Sutherlin|Douglas; South Umpqua School District|Myrtle Creek|Douglas; Winston-Dillard School District|Winston|Douglas; Reedsport School District|Reedsport|Douglas; North Douglas School District|Drain|Douglas; Glide School District|Glide|Douglas; Oakland School District|Oakland|Douglas; Riddle School District|Riddle|Douglas; Glendale School District|Glendale|Douglas; Days Creek School District|Days Creek|Douglas; Camas Valley School District|Camas Valley|Douglas; Elkton School District|Elkton|Douglas; Yoncalla School District|Yoncalla|Douglas; Junction City School District|Junction City|Lane; Fern Ridge School District|Elmira|Lane; Creswell School District|Creswell|Lane; Pleasant Hill School District|Pleasant Hill|Lane; Oakridge School District|Oakridge|Lane; Lowell School District|Lowell|Lane; Siuslaw School District|Florence|Lane; McKenzie School District|Finn Rock|Lane; Marcola School District|Marcola|Lane; Mapleton School District|Mapleton|Lane; Crow-Applegate-Lorane School District|Crow|Lane; Blachly School District|Blachly|Lane; Philomath School District|Philomath|Benton; Monroe School District|Monroe|Benton; Alsea School District|Alsea|Benton; Central Linn School District|Halsey|Linn; Harrisburg School District|Harrisburg|Linn; Scio School District|Scio|Linn; Santiam Canyon School District|Mill City|Marion; Jefferson School District|Jefferson|Marion; Gervais School District|Gervais|Marion; North Marion School District|Aurora|Marion; Mt. Angel School District|Mount Angel|Marion; St. Paul School District|St. Paul|Marion; Perrydale School District|Amity|Polk; Falls City School District|Falls City|Polk; Amity School District|Amity|Yamhill; Dayton School District|Dayton|Yamhill; Sheridan School District|Sheridan|Yamhill; Willamina School District|Willamina|Yamhill; Yamhill Carlton School District|Yamhill|Yamhill; Banks School District|Banks|Washington; Gaston School District|Gaston|Washington; Hood River County School District|Hood River|Hood River; North Wasco County School District|The Dalles|Wasco; South Wasco County School District|Maupin|Wasco; Dufur School District|Dufur|Wasco; Sherman County School District|Wasco|Sherman; Condon School District|Condon|Gilliam; Arlington School District|Arlington|Gilliam; Fossil School District|Fossil|Wheeler; Mitchell School District|Mitchell|Wheeler; Spray School District|Spray|Wheeler; Morrow County School District|Lexington|Morrow; Ione School District|Ione|Morrow; Umatilla School District|Umatilla|Umatilla; Stanfield School District|Stanfield|Umatilla; Echo School District|Echo|Umatilla; Athena-Weston School District|Athena|Umatilla; Helix School District|Helix|Umatilla; Pilot Rock School District|Pilot Rock|Umatilla; Ukiah School District|Ukiah|Umatilla; Milton-Freewater Unified School District|Milton-Freewater|Umatilla; La Grande School District|La Grande|Union; Union School District|Union|Union; Elgin School District|Elgin|Union; Imbler School District|Imbler|Union; Cove School District|Cove|Union; North Powder School District|North Powder|Union; Enterprise School District|Enterprise|Wallowa; Joseph School District|Joseph|Wallowa; Wallowa School District|Wallowa|Wallowa; Troy School District|Enterprise|Wallowa; Baker School District|Baker City|Baker; Pine Eagle School District|Halfway|Baker; Burnt River School District|Unity|Baker; Huntington School District|Huntington|Baker; Ontario School District|Ontario|Malheur; Vale School District|Vale|Malheur; Nyssa School District|Nyssa|Malheur; Adrian School District|Adrian|Malheur; Jordan Valley School District|Jordan Valley|Malheur; Harper School District|Harper|Malheur; Juntura School District|Juntura|Malheur; Annex School District|Ontario|Malheur; Arock School District|Arock|Malheur; McDermitt School District|McDermitt|Malheur; Grant School District 3|Canyon City|Grant; Prairie City School District|Prairie City|Grant; Long Creek School District|Long Creek|Grant; Monument School District|Monument|Grant; Dayville School District|Dayville|Grant; Harney County School District 3|Burns|Harney; Harney County Union High School District|Crane|Harney; South Harney School District|Fields|Harney; Lake County School District|Lakeview|Lake; North Lake School District|Silver Lake|Lake; Paisley School District|Paisley|Lake; Plush School District|Plush|Lake; Adel School District|Adel|Lake; Culver School District|Culver|Jefferson; Black Butte School District|Camp Sherman|Jefferson; Sisters School District|Sisters|Deschutes; Butte Falls School District|Butte Falls|Jackson; Prospect School District|Prospect|Jackson; Rogue River School District|Rogue River|Jackson; Pinehurst School District|Ashland|Jackson"""

ID_SCHOOLS = """West Ada School District|Meridian|Ada; Boise School District|Boise|Ada; Nampa School District|Nampa|Canyon; Vallivue School District|Caldwell|Canyon; Caldwell School District|Caldwell|Canyon; Middleton School District|Middleton|Canyon; Kuna School District|Kuna|Ada; Bonneville Joint School District 93|Idaho Falls|Bonneville; Idaho Falls School District 91|Idaho Falls|Bonneville; Pocatello-Chubbuck School District 25|Pocatello|Bannock; Coeur d'Alene School District|Coeur d'Alene|Kootenai; Lakeland Joint School District|Rathdrum|Kootenai; Post Falls School District|Post Falls|Kootenai; Kootenai Joint School District|Harrison|Kootenai; Twin Falls School District|Twin Falls|Twin Falls; Madison School District|Rexburg|Madison; Sugar-Salem School District|Sugar City|Madison; Lewiston School District|Lewiston|Nez Perce; Lapwai School District|Lapwai|Nez Perce; Moscow School District|Moscow|Latah; Genesee School District|Genesee|Latah; Kendrick Joint School District|Kendrick|Latah; Potlatch School District|Potlatch|Latah; Troy School District|Troy|Latah; Whitepine Joint School District|Deary|Latah; Jefferson County Joint School District|Rigby|Jefferson; Ririe Joint School District|Ririe|Jefferson; West Jefferson School District|Terreton|Jefferson; Blackfoot School District|Blackfoot|Bingham; Snake River School District|Blackfoot|Bingham; Shelley Joint School District|Shelley|Bingham; Firth School District|Firth|Bingham; Aberdeen School District|Aberdeen|Bingham; Shoshone-Bannock School District|Fort Hall|Bingham; Mountain Home School District|Mountain Home|Elmore; Glenns Ferry Joint School District|Glenns Ferry|Elmore; Jerome Joint School District|Jerome|Jerome; Valley School District|Hazelton|Jerome; Cassia County Joint School District|Burley|Cassia; Minidoka County Joint School District|Rupert|Minidoka; Blaine County School District|Hailey|Blaine; Lake Pend Oreille School District|Sandpoint|Bonner; West Bonner County School District|Priest River|Bonner; Boundary County School District|Bonners Ferry|Boundary; Emmett Independent School District|Emmett|Gem; Payette Joint School District|Payette|Payette; Fruitland School District|Fruitland|Payette; New Plymouth School District|New Plymouth|Payette; Weiser School District|Weiser|Washington; Cambridge Joint School District|Cambridge|Washington; Midvale School District|Midvale|Washington; Preston Joint School District|Preston|Franklin; West Side Joint School District|Dayton|Franklin; Fremont County Joint School District|St. Anthony|Fremont; Teton County School District|Driggs|Teton; McCall-Donnelly Joint School District|McCall|Valley; Cascade School District|Cascade|Valley; Meadows Valley School District|New Meadows|Adams; Council School District|Council|Adams; Gooding Joint School District|Gooding|Gooding; Wendell School District|Wendell|Gooding; Hagerman Joint School District|Hagerman|Gooding; Bliss Joint School District|Bliss|Gooding; Buhl Joint School District|Buhl|Twin Falls; Filer School District|Filer|Twin Falls; Kimberly School District|Kimberly|Twin Falls; Hansen School District|Hansen|Twin Falls; Castleford School District|Castleford|Twin Falls; Murtaugh Joint School District|Murtaugh|Twin Falls; Three Creek Joint Elementary School District|Rogerson|Twin Falls; Shoshone Joint School District|Shoshone|Lincoln; Richfield School District|Richfield|Lincoln; Dietrich School District|Dietrich|Lincoln; Camas County School District|Fairfield|Camas; Mountain View School District|Grangeville|Idaho; Cottonwood Joint School District|Cottonwood|Idaho; Salmon River Joint School District|Riggins|Idaho; Orofino Joint School District|Orofino|Clearwater; Highland Joint School District|Craigmont|Lewis; Kamiah Joint School District|Kamiah|Lewis; Nezperce Joint School District|Nezperce|Lewis; Culdesac Joint School District|Culdesac|Nez Perce; Kellogg Joint School District|Kellogg|Shoshone; Wallace School District|Wallace|Shoshone; Mullan School District|Mullan|Shoshone; Avery School District|Avery|Shoshone; St. Maries Joint School District|St. Maries|Benewah; Plummer-Worley Joint School District|Plummer|Benewah; Salmon School District|Salmon|Lemhi; South Lemhi School District|Leadore|Lemhi; Challis Joint School District|Challis|Custer; Mackay Joint School District|Mackay|Custer; Butte County Joint School District|Arco|Butte; Clark County School District|Dubois|Clark; Soda Springs Joint School District|Soda Springs|Caribou; Grace Joint School District|Grace|Caribou; North Gem School District|Bancroft|Caribou; Bear Lake County School District|Paris|Bear Lake; Oneida County School District|Malad City|Oneida; Marsh Valley Joint School District|Arimo|Bannock; American Falls Joint School District|American Falls|Power; Rockland School District|Rockland|Power; Arbon Elementary School District|Arbon|Power; Homedale Joint School District|Homedale|Owyhee; Marsing Joint School District|Marsing|Owyhee; Bruneau-Grand View Joint School District|Grand View|Owyhee; Pleasant Valley Elementary School District|Jordan Valley|Owyhee; Notus School District|Notus|Canyon; Parma School District|Parma|Canyon; Wilder School District|Wilder|Canyon; Melba Joint School District|Melba|Canyon; Basin School District|Idaho City|Boise; Garden Valley School District|Garden Valley|Boise; Horseshoe Bend School District|Horseshoe Bend|Boise"""

# Major non-city, non-county, non-school agencies. URLs are from memory: status stays
# 'candidate' until the discovery script or a person confirms them.
OR_OTHER = [
    ("Metro (Portland regional government)", "special_district", "Multnomah", "Portland", "https://www.oregonmetro.gov/"),
    ("TriMet", "transit", "Multnomah", "Portland", "https://trimet.org/"),
    ("Port of Portland", "port", "Multnomah", "Portland", "https://www.portofportland.com/"),
    ("Lane Transit District", "transit", "Lane", "Eugene", "https://www.ltd.org/"),
    ("Salem Area Mass Transit District (Cherriots)", "transit", "Marion", "Salem", "https://www.cherriots.org/"),
    ("Rogue Valley Transportation District", "transit", "Jackson", "Medford", "https://rvtd.org/"),
    ("Cascades East Transit (Central Oregon Intergovernmental Council)", "transit", "Deschutes", "Bend", "https://cascadeseasttransit.com/"),
    ("Eugene Water & Electric Board", "utility", "Lane", "Eugene", "https://www.eweb.org/"),
    ("Central Lincoln People's Utility District", "utility", "Lincoln", "Newport", "https://clpud.org/"),
    ("Emerald People's Utility District", "utility", "Lane", "Eugene", "https://www.epud.org/"),
    ("Clatskanie People's Utility District", "utility", "Columbia", "Clatskanie", "https://www.clatskaniepud.com/"),
    ("Columbia River People's Utility District", "utility", "Columbia", "St. Helens", "https://www.crpud.net/"),
    ("Northern Wasco County People's Utility District", "utility", "Wasco", "The Dalles", "https://www.nwasco.com/"),
    ("Tualatin Valley Water District", "water", "Washington", "Beaverton", "https://www.tvwd.org/"),
    ("Clean Water Services", "water", "Washington", "Hillsboro", "https://www.cleanwaterservices.org/"),
    ("Water Environment Services (Clackamas County)", "water", "Clackamas", "Oregon City", "https://www.clackamas.us/wes"),
    ("Tualatin Hills Park & Recreation District", "parks", "Washington", "Beaverton", "https://www.thprd.org/"),
    ("Willamalane Park and Recreation District", "parks", "Lane", "Springfield", "https://www.willamalane.org/"),
    ("Bend Park & Recreation District", "parks", "Deschutes", "Bend", "https://www.bendparksandrec.org/"),
    ("Tualatin Valley Fire & Rescue", "fire", "Washington", "Tigard", "https://www.tvfr.com/"),
    ("Clackamas Fire District #1", "fire", "Clackamas", "Milwaukie", "https://www.clackamasfire.com/"),
    ("Port of Astoria", "port", "Clatsop", "Astoria", "https://www.portofastoria.com/"),
    ("Oregon International Port of Coos Bay", "port", "Coos", "Coos Bay", "https://www.portofcoosbay.com/"),
    ("Port of Newport", "port", "Lincoln", "Newport", "https://www.portofnewport.com/"),
    ("Port of Morrow", "port", "Morrow", "Boardman", "https://www.portofmorrow.com/"),
    ("Port of Hood River", "port", "Hood River", "Hood River", "https://portofhoodriver.com/"),
    ("Port of The Dalles", "port", "Wasco", "The Dalles", "https://www.portofthedalles.com/"),
    ("Port of Columbia County", "port", "Columbia", "St. Helens", "https://www.portofcolumbiacounty.org/"),
    ("Port of Tillamook Bay", "port", "Tillamook", "Tillamook", "https://www.potb.org/"),
    ("Port of Umatilla", "port", "Umatilla", "Umatilla", "https://www.portofumatilla.org/"),
    ("Oregon Department of Transportation", "state", "Marion", "Salem", "https://www.oregon.gov/odot/"),
    ("Oregon Department of Administrative Services", "state", "Marion", "Salem", "https://www.oregon.gov/das/"),
    ("Oregon State University", "higher_ed", "Benton", "Corvallis", "https://oregonstate.edu/"),
    ("University of Oregon", "higher_ed", "Lane", "Eugene", "https://www.uoregon.edu/"),
    ("Portland State University", "higher_ed", "Multnomah", "Portland", "https://www.pdx.edu/"),
    ("Oregon Health & Science University", "higher_ed", "Multnomah", "Portland", "https://www.ohsu.edu/"),
    ("Portland Community College", "higher_ed", "Multnomah", "Portland", "https://www.pcc.edu/"),
    ("Lane Community College", "higher_ed", "Lane", "Eugene", "https://www.lanecc.edu/"),
    ("Chemeketa Community College", "higher_ed", "Marion", "Salem", "https://www.chemeketa.edu/"),
    ("Mt. Hood Community College", "higher_ed", "Multnomah", "Gresham", "https://www.mhcc.edu/"),
    ("Clackamas Community College", "higher_ed", "Clackamas", "Oregon City", "https://www.clackamas.edu/"),
    ("Central Oregon Community College", "higher_ed", "Deschutes", "Bend", "https://www.cocc.edu/"),
    ("Housing Authority of Clackamas County", "special_district", "Clackamas", "Oregon City", None),
    ("Home Forward (Portland housing authority)", "special_district", "Multnomah", "Portland", "https://www.homeforward.org/"),
    ("Multnomah County Drainage District", "special_district", "Multnomah", "Portland", None),
]

ID_OTHER = [
    ("Ada County Highway District", "special_district", "Ada", "Garden City", "https://achdidaho.org/"),
    ("Valley Regional Transit", "transit", "Ada", "Meridian", "https://www.valleyregionaltransit.org/"),
    ("Idaho Transportation Department", "state", "Ada", "Boise", "https://itd.idaho.gov/"),
    ("Idaho Division of Public Works", "state", "Ada", "Boise", "https://dpw.idaho.gov/"),
    ("Boise State University", "higher_ed", "Ada", "Boise", "https://www.boisestate.edu/"),
    ("University of Idaho", "higher_ed", "Latah", "Moscow", "https://www.uidaho.edu/"),
    ("Idaho State University", "higher_ed", "Bannock", "Pocatello", "https://www.isu.edu/"),
    ("Lewis-Clark State College", "higher_ed", "Nez Perce", "Lewiston", "https://www.lcsc.edu/"),
    ("College of Western Idaho", "higher_ed", "Canyon", "Nampa", "https://cwi.edu/"),
    ("College of Southern Idaho", "higher_ed", "Twin Falls", "Twin Falls", "https://www.csi.edu/"),
    ("North Idaho College", "higher_ed", "Kootenai", "Coeur d'Alene", "https://www.nic.edu/"),
    ("College of Eastern Idaho", "higher_ed", "Bonneville", "Idaho Falls", "https://www.cei.edu/"),
    ("Port of Lewiston", "port", "Nez Perce", "Lewiston", "https://www.portoflewiston.com/"),
    ("Idaho Falls Power", "utility", "Bonneville", "Idaho Falls", None),
    ("Kootenai Electric Cooperative", "utility", "Kootenai", "Hayden", None),
    ("Lakes Highway District", "special_district", "Kootenai", "Coeur d'Alene", None),
    ("Post Falls Highway District", "special_district", "Kootenai", "Post Falls", None),
    ("Canyon Highway District No. 4", "special_district", "Canyon", "Caldwell", None),
    ("Nampa Highway District No. 1", "special_district", "Canyon", "Nampa", None),
    ("Boise Airport (City of Boise)", "special_district", "Ada", "Boise", None),
    ("Mountain Rides Transportation Authority", "transit", "Blaine", "Ketchum", None),
    ("Central District Health", "special_district", "Ada", "Boise", None),
    ("Panhandle Health District", "special_district", "Kootenai", "Hayden", None),
    ("Boise Project Board of Control", "water", "Ada", "Boise", None),
    ("Pioneer Irrigation District", "water", "Canyon", "Caldwell", None),
    ("Nampa & Meridian Irrigation District", "water", "Canyon", "Nampa", None),
    ("Eagle Fire District", "fire", "Ada", "Eagle", None),
    ("Kootenai County Fire & Rescue", "fire", "Kootenai", "Post Falls", None),
]

# Shared portals that local OR/ID agencies post to. These save the most per-agency work.
PLATFORMS = {
    "OR": [
        ("or-platform-bidnet", "Oregon Purchasing Group (BidNet Direct)", "https://www.bidnetdirect.com/oregon", "bidnet"),
        ("or-platform-questcdn-portland-metro", "QuestCDN (Oregon public works plan rooms)", "https://www.questcdn.com/", "questcdn"),
    ],
    "ID": [
        ("id-platform-bidnet", "Idaho Purchasing Group (BidNet Direct)", "https://www.bidnetdirect.com/idaho", "bidnet"),
        ("id-platform-dpw", "Idaho Division of Public Works bid opportunities", "https://dpw.idaho.gov/", "custom"),
    ],
}


def slug(s):
    s = s.lower().replace("&", "and").replace("'", "")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def parse_cities(blob):
    out = []
    for item in blob.split(", "):
        m = re.match(r"(.+?) \((.+)\)$", item.strip())
        out.append((m.group(1), m.group(2)))
    return out


def parse_schools(blob):
    return [tuple(x.strip() for x in row.split("|")) for row in blob.split(";")]


def norm(name):
    name = name.lower().replace("st.", "saint").replace("mt.", "mount").replace("'", "")
    return re.sub(r"[^a-z]", "", name)


def load_places(path, state):
    """GeoNames places in `state` keyed by normalized name -> list of (lat, lng, county_fips)."""
    places = {}
    for c in json.load(open(path)):
        if c.get("country") == "US" and c.get("admin1") == state:
            places.setdefault(norm(c["name"]), []).append((float(c["lat"]), float(c["lng"]), c["admin2"]))
    return places


def county_centroids(path, state):
    """Bounding-box centre of each county's arcs from the us-atlas TopoJSON."""
    topo = json.load(open(path))
    sx, sy = topo["transform"]["scale"]
    tx, ty = topo["transform"]["translate"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append((x * sx + tx, y * sy + ty))
        arcs.append(pts)

    def arc_ids(geom):
        def flat(a):
            for v in a:
                if isinstance(v, list):
                    yield from flat(v)
                else:
                    yield v if v >= 0 else ~v
        return flat(geom["arcs"])

    out = {}
    for g in topo["objects"]["counties"]["geometries"]:
        if not g["id"].startswith(STATE_FIPS[state]):
            continue
        pts = [p for i in arc_ids(g) for p in arcs[i]]
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        out[g["properties"]["name"]] = {
            "fips": g["id"][2:],
            "lat": round((min(ys) + max(ys)) / 2, 5),
            "lng": round((min(xs) + max(xs)) / 2, 5),
        }
    return out


def row(state, id_, name, agency_type, county, city, lat, lng, homepage=None, procurement=None,
        platform=None, fetch_method=None, status=None, discovered_via="manual", notes=None, raw=None):
    if status is None:
        status = "candidate" if procurement else "missing"
    return {
        "id": id_, "name": name, "state": state, "agency_type": agency_type,
        "county": county, "city": city, "lat": lat, "lng": lng,
        "homepage_url": homepage, "procurement_url": procurement, "platform": platform,
        "fetch_method": fetch_method, "status": status, "last_verified": None,
        "discovered_via": discovered_via, "notes": notes, "raw": raw,
    }


def build(state, cities_path, counties_path):
    st = state.lower()
    places = load_places(cities_path, state)
    counties = county_centroids(counties_path, state)
    fips_to_county = {v["fips"]: k for k, v in counties.items()}

    def locate(city, county):
        cands = places.get(norm(city), [])
        for lat, lng, fips in cands:
            if fips_to_county.get(fips) == county:
                return round(lat, 5), round(lng, 5), "geonames"
        if cands:
            return round(cands[0][0], 5), round(cands[0][1], 5), "geonames"
        c = counties[county]
        return c["lat"], c["lng"], "county_centroid"

    rows = []
    for name, c in sorted(counties.items()):
        rows.append(row(state, f"{st}-county-{slug(name)}", f"{name} County", "county", name, None,
                        c["lat"], c["lng"], raw={"county_fips": STATE_FIPS[state] + c["fips"],
                                                 "geo": "county_bbox_center"}))

    for city, county in parse_cities(OR_CITIES if state == "OR" else ID_CITIES):
        lat, lng, geo = locate(city, county)
        rows.append(row(state, f"{st}-city-{slug(city)}", f"City of {city}", "city", county, city,
                        lat, lng, raw={"geo": geo, "list": "wikipedia incorporated cities"}))

    for name, city, county in parse_schools(OR_SCHOOLS if state == "OR" else ID_SCHOOLS):
        lat, lng, geo = locate(city, county)
        rows.append(row(state, f"{st}-school-{slug(name.replace(' School District', ''))}", name,
                        "school", county, city, lat, lng, raw={"geo": geo}))

    for name, agency_type, county, city, homepage in (OR_OTHER if state == "OR" else ID_OTHER):
        lat, lng, geo = locate(city, county)
        rows.append(row(state, f"{st}-{agency_type.replace('_', '-')}-{slug(name.split(' (')[0])}", name,
                        agency_type, county, city, lat, lng, homepage=homepage,
                        notes="homepage from memory; verify" if homepage else None, raw={"geo": geo}))

    for id_, name, url, platform in PLATFORMS[state]:
        rows.append(row(state, id_, name, "platform", None, None, None, None, homepage=url,
                        procurement=url, platform=platform, fetch_method="browser",
                        notes="shared portal; URL from memory, verify"))

    ids = [r["id"] for r in rows]
    dupes = {i for i in ids if ids.count(i) > 1}
    assert not dupes, dupes
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cities", required=True)
    ap.add_argument("--counties", required=True)
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    for state in ("OR", "ID"):
        rows = build(state, args.cities, args.counties)
        (OUT / f"{state.lower()}.json").write_text(json.dumps(rows, indent=2) + "\n")
        print(state, len(rows), "rows")


if __name__ == "__main__":
    main()
