const geoPath = d3.geoPath();
let combined_data;


const chartsInfo = {
  // income: "Interesting insight: Wealthier states tend to have less obesity.",
  // smokes: "Interesting insight: Smoking has a positive correlation obesity.",
  // age: "Interesting insight: Obesity rate is mostly found in the age group of 35 to 40 years.",
  // poverty: "Interesting insight: Positive correlation between Obesity and Poverty. Southern states tend to have the highest rates of obesity, poverty.",
  // healthcare: "Interesting insight: States with lack of health coverage tend to have more obesity.Texas being an outlier as it has the highest % lack in healthcare.",
  oil_price: "Interesting insight: States with higher oil price tend to have more EV.",
  Gasoline: "Interesting insight: Positive correlation between the number of gasoline cars and EV."
}

// chart parameters
// const width = 800;
// const height = 600;
const NODE = { MIN_RADIUS: 4, MAX_RADIUS: 20, PADDING: 2 };

// Dimensions.
const margin = { top: 80, right: 40, bottom: 40, left: 40 };
const width = 1100 - margin.right - margin.left;
const height = 750 - margin.top - margin.bottom;

let svg;

const MIN_YEAR = 2016;
const MAX_YEAR = 2022;
let selectedYear = 2016;
let obesityToRadius;
// const year_selector = (year) => MAX_YEAR - year
const year_selector = (year) => year - MIN_YEAR

const logScale = d3.scaleLog()
      // .domain([start, end])
      .domain([3500, 2778700]);
const colorScale = d3.scaleSequential((d) => d3.interpolateReds(logScale(d)));
  // .range()
  // .domain([10, 40]);
  // .domain([3500, 2778700]);


let cartogramControls;

// creates, appends and returns base outline map of US 
const createBaseMap = (stateBoundaries, nation) => {
  const svg_width = width + margin.right + margin.left
  const svg_height = height + margin.top + margin.bottom
  svg = d3
    .select("#cartogram-svg")
    .attr("viewBox", `-30 -20 ${svg_width} ${690}`)

  svg
    .append('g')
    .append("path")
    .classed("state-boundaries", true)
    .datum(stateBoundaries)
    .attr("fill", "none")
    .attr("stroke", "lightgray")
    .attr("stroke-width", 1)
    .attr("stroke-linejoin", "round")
    .attr("d", d3.geoPath());

  svg
    .append("path")
    .classed("nation-boundary", true)
    .datum(nation)
    .attr("fill", "none")
    .attr("stroke", "gray")
    .attr("stroke-linejoin", "round")
    .attr("d", d3.geoPath());

  return svg.node();
};

const applySimulation = (nodes) => {
  const simulation = d3.forceSimulation(nodes)
    .force("cx", d3.forceX().x(d => width / 2).strength(0.02))
    .force("cy", d3.forceY().y(d => height / 2).strength(0.02))
    .force("x", d3.forceX().x(d => d.x).strength(0.3))
    .force("y", d3.forceY().y(d => d.y).strength(0.3))
    .force("charge", d3.forceManyBody().strength(-1))
    .force("collide", d3.forceCollide().radius(d => d.r + NODE.PADDING).strength(1))
    .stop()

  while (simulation.alpha() > 0.01) {
    simulation
      .tick()
  }

  return simulation.nodes();
}

const drawCartogram = async () => {
  const us = await d3.json("d3-playground/resources/us-atlas@2.1.0-us-10m.json");
  // combined_data = await d3.json("data/scatter_cartogram.json");
  combined_data = await d3.json("data/new_data.json");
  const stateBoundaries = topojson.mesh(us, us.objects.states, (a, b) => a !== b);
  const nation = topojson.mesh(us, us.objects.nation);
  const states = topojson.feature(us, us.objects.states);

  const year = year_selector(selectedYear)


  // creating the general outline of the US with states
  const baseMap = createBaseMap(stateBoundaries, nation);

  // this is a scale for converting obesity % to a radius
  obesityToRadius = d3.scaleSqrt()
    .domain(d3.extent(Object.values(combined_data), d => d.EV_data[year]))
    .range([NODE.MIN_RADIUS, NODE.MAX_RADIUS])

  states.features.forEach((feature) => {
    const [x, y] = geoPath.centroid(feature);
    const { name } = feature.properties
    const combined = combined_data[name]
    const r = obesityToRadius(combined.EV_data[year])
    feature.properties = { ...feature.properties, ...combined_data[name], x, y, r };
  });

  const data = states.features.map((d) => d.properties)
  // const dataByState = d3.group(data, d => d.state)
  // const statesPacked = createStatePacks(dataByState, radius, csv_data);
  // let values = [...new Map(statesPacked).values()];
  const values = applySimulation(data)

  const bubbles = d3.select(baseMap)
    .append("g")
    .classed("centroids", true)


  let bubbles_group = bubbles.selectAll("g")
    .data(values)

  bubbles_group = bubbles_group
    .join("g")
    .classed('scatterBubbleGroup', true)
    // .on("click", d => click(d))
    // .style('opacity', '50%')


  bubbles_group
    .classed('scatterBubble', true)
    .attr("transform", d => `translate(${d.x}, ${d.y})`)
    .append('circle')
    .attr("r", (d) => obesityToRadius(d.EV_data[year]))
    // .attr("fill", "rgba(63, 191, 108)")
    .attr("fill", d => colorScale(+d.EV_data[year]))
    // .attr("stroke", "black")
    .attr("stroke-width", 1)


  // adding the State Abbreviation to the bubbles
  bubbles_group
    .append('text')
    .attr("y", -10)
    .attr("font-size",35)
    .classed('stateText', true)
    .text(d => d.abbreviation)
    .attr("fill","red")
    
  // adding the Value (obesity % at first) annotation to the bubbles
  bubbles_group
    .append('text')
    .classed('stateValue', true)
    .attr("y", 20)
    .text(d => `${d.EV_data[year]}`)

  let moving = false;
  let currentValue = MIN_YEAR;
  const targetValue = MAX_YEAR;
  let timer;

  function step() {
    const yearslider = d3.select("#cartogram_year")
    currentValue = yearslider.attr("value");
    updateYear(currentValue)
    //update(x.invert(currentValue));
    currentValue = +currentValue + 1;
    yearslider.attr("value", currentValue);
    if (+currentValue > +targetValue) {
      moving = false;
      currentValue = 0;
      clearInterval(timer);
      playButton.text("Play");
      console.log("Slider moving: " + moving);
    }
  }

  const playButton = d3.select("#play-button")
    .on("click", function () {
      var button = d3.select(this);
      if (button.text() == "Pause") {
        moving = false;
        clearInterval(timer);
        timer = 0;
        button.text("Play");
      } else {
        moving = true;
        timer = setInterval(step, 1000);
        button.text("Pause");
      }
      console.log("Slider moving: " + moving);
    })
};

const updateScatter = (caller) => {
  console.log(caller)
  const id = caller.id
  const chosenXAxis = id
  const axisLabel = caller.text;

  cartogramControls = d3.select("#cartogram_controls_container").style('opacity', '0')
  d3.selectAll(".x").remove()

  d3.selectAll('.scatter-x-axis').classed('selected-axis', false)
  d3.select(`#${chosenXAxis}`).classed('selected-axis', true)

  d3.select(`#chart-title`).text('Correlations')
  d3.select(`#chart-description`).text('Interesting insight:')

  d3.select(`#chart-description`).text(chartsInfo[id])

  const scatterData = d3.values(combined_data)

  console.log('scatterData')
  console.log(scatterData)

  function addLabel(axis, label, x, y = 0, deg = 0) {
    axis
      .select('.tick:last-of-type text')
      .clone()
      .text(label)
      .attr('x', x)
      .attr('y', y)
      .style('text-anchor', 'start')
      .style('font-weight', 'bold')
      .style('transform', `rotate(${deg}deg)`)
      .style('fill', '#555');
  }

  // Scales.
  const xExtent = d3
    .extent(scatterData, d => +d.scatter[chosenXAxis])
    .map((d, i) => (i === 0 ? d * 0.9 : d * 1.05));

  const xScale = d3
    .scaleLinear()
    .domain(xExtent)
    .range([0, width]);

  const yExtent = d3
    // .extent(scatterData, d => +d.scatter.obesity)
    // .extent(scatterData, d => +d.EV_data['2022'])
    .extent(scatterData, d => +d.EV)
    .map((d, i) => (i === 0 ? d * 0.97 : d * 1.05));

  console.log('yExtent')
  console.log(yExtent)

  const yScale = d3
    // .scaleLinear()
    .scaleLog()
    .domain(yExtent)
    .range([height, 0]);

  console.log('yScale')
  console.log(yScale)

  // Draw x axis.
  const xAxis = d3
    .axisBottom(xScale)
    .ticks(5)
    // .tickFormat(formatTicks)
    // .tickSizeInner(-height)
    .tickSizeOuter(0);

  const xAxisDraw = svg
    .append('g')
    .attr('class', 'x axis')

  xAxisDraw
    .attr('transform', `translate(0, ${height})`)
    .call(xAxis)
    .call(addLabel, axisLabel, 30, 8)

  xAxisDraw.selectAll('text').attr('dy', '1em');

  // Draw y axis.
  const yAxis = d3
    .axisRight(yScale)
    .ticks(15)
    .tickSizeOuter(0);

  const yAxisDraw = svg
    .append('g')
    .attr('class', 'y axis')
    .call(yAxis)
    .call(addLabel, 'EV count', -135, -15, -90);

  // show the axis
  xAxisDraw.transition()
    .duration(1000)
    .delay(2500)
    .style("opacity", 1)

  // show the axis
  yAxisDraw.transition()
    .duration(1000)
    .delay(2500)
    .style("opacity", 1)


  // hide the state outline
  d3.selectAll(".state-boundaries,.nation-boundary")
    .transition()
    .duration(1000)
    .style('transform', 'scale(0.1)')
    .transition()
    .delay(200)
    .style('display', 'none')


  // move the bubbles to the right x and y coordinates
  d3.selectAll(".scatterBubble")
    .transition()
    .delay(1000)
    .duration(750)
    // .delay((d, i) => i * 15)
    .attr("transform", d => {
      const x = d.x
      // const y = yScale(d.scatter.obesity)
      const y = yScale(d.EV)
      return `translate(${x}, ${y})`
    })
    .transition()
    .attr("transform", d => {
      const x = xScale(d.scatter[chosenXAxis])
      // const y = yScale(d.scatter.obesity)
      const y = yScale(d.EV)
      return `translate(${x}, ${y})`
    })
}

const updateCartogram = () => {
  cartogramControls = d3.select("#cartogram_controls_container").style('opacity', '1')
  d3.selectAll(".x").remove()
  d3.selectAll(".y").remove()

  // d3.select('body').append(cartogramControls.node())
  // hide the state outline
  d3.selectAll(".state-boundaries,.nation-boundary")
    .style('display', 'block')
    .transition()
    .duration(2000)
    .style('transform', 'scale(1)')
    .transition()

  // move the bubbles to the right x and y coordinates
  d3.selectAll(".scatterBubble")
    .transition()
    .duration(750)
    .delay((d, i) => i * 15)
    .attr("transform", d => {
      const x = d.x
      const y = d.y
      return `translate(${x}, ${y})`
    })
    .transition()

  d3.select('#chart-title')
    .text('EV Cartogram')

  d3.select('#chart-description')
    .text('EV trend across the States in the US is rising')

}


const updateYear = (year) => {
  selectedYear = year;
  console.log(selectedYear)





  const year_index = year_selector(year)
  const bubbles = d3.selectAll(".scatterBubble")
    .selectAll('circle')

  bubbles.transition()
    .ease(d3.easeElastic)
    .duration(750)



  bubbles
    .attr('r', d => obesityToRadius(d.EV_data[year_index]))
    .attr("fill", d => colorScale(+d.EV_data[year_index]))


  d3.selectAll('.stateValue').text(d => { return `${d.EV_data[year_index]}` })


}

drawCartogram()
// update('income')
// setTimeout(() => update('income'), 300)
// d3.select('#income').on('click', function () { updateScatter('income', this) })
// d3.select('#smokes').on('click', function () { updateScatter('smokes', this) })
// d3.select('#age').on('click', function () { updateScatter('age', this) })
// d3.select('#poverty').on('click', function () { updateScatter('poverty', this) })
// d3.select('#healthcare').on('click', function () { updateScatter('healthcare', this) })

d3.selectAll('.scatter-x-axis')
  .on('click', function (e) { updateScatter(this); })


d3.select('#backToMap').on('click', function () { updateCartogram() })

d3.select('input[type=range]#cartogram_year').on('input', function () {
  const year = this.value
  updateYear(year)
})
